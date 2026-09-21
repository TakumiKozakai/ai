import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import runner


class RunnerTests(unittest.TestCase):
    def setUp(self):
        self.config = json.loads((runner.ROOT / 'config.todo-local.json').read_text())
        self.case = self.config['cases'][0]

    def test_invalid_query_and_origin_rejected_before_connections(self):
        self.config['baseUrl'] = 'https://production.example.com'
        with self.assertRaises(ValueError):
            runner.validate(self.config)
        self.config['baseUrl'] = 'http://localhost:8080'
        self.case['database']['query'] = 'SELECT 1; DELETE FROM todos'
        with self.assertRaises(ValueError):
            runner.validate(self.config)

    def test_missing_aws_configuration_is_not_silently_skipped(self):
        del self.case['s3']
        with self.assertRaises(ValueError):
            runner.validate(self.config)

    def test_before_failure_blocks_browser_but_attempts_after(self):
        with tempfile.TemporaryDirectory() as root, \
                patch.object(runner, 'db_snapshot', side_effect=[RuntimeError('offline'), []]) as db, \
                patch.object(runner, 'browser') as browser:
            checks = runner.run_case(self.config, self.case, Path(root) / 'case', True)
            browser.assert_not_called()
            self.assertEqual(db.call_count, 2)
            self.assertIn('NOT_RUN', [c['status'] for c in checks])
            self.assertEqual(runner.report(Path(root), checks), 1)

    def test_browser_failure_still_collects_db_s3_and_ec2(self):
        self.case['s3'] = {'bucket': 'sample', 'prefix': '', 'expectedKeys': ['result.txt']}
        self.case['ec2'] = {'contains': ['request completed']}
        with tempfile.TemporaryDirectory() as root, \
                patch.object(runner, 'db_snapshot', side_effect=[[{'id': 1}], [{'id': 1}]]) as db, \
                patch.object(runner, 'browser', side_effect=RuntimeError('UI failed')), \
                patch.object(runner, 's3_snapshot', return_value={'Contents': [{'Key': 'result.txt'}]}) as s3, \
                patch.object(runner, 'ec2_log', return_value='request completed') as ec2:
            checks = runner.run_case(self.config, self.case, Path(root) / 'case', True)
            self.assertEqual(db.call_count, 2)
            s3.assert_called_once()
            ec2.assert_called_once()
            self.assertEqual(runner.report(Path(root), checks), 1)

    def test_db_difference_and_missing_s3_objects_fail(self):
        self.case['s3'] = {'expectedKeys': ['missing.txt']}
        with tempfile.TemporaryDirectory() as root, \
                patch.object(runner, 'db_snapshot', side_effect=[[], [{'id': 1}]]), \
                patch.object(runner, 'browser'), \
                patch.object(runner, 's3_snapshot', return_value={}):
            checks = runner.run_case(self.config, self.case, Path(root) / 'case', True)
            failures = [c['name'] for c in checks if c['status'] == 'FAIL']
            self.assertEqual(failures, ['DB unchanged', 'S3'])

    def test_psql_uses_read_only_transaction_and_password_not_in_args(self):
        with patch.object(runner, 'command', return_value=json.dumps(
                {'database': 'appdb', 'user': 'readonly_user', 'rows': []})) as command:
            runner.db_snapshot(self.config, self.case)
            args, kwargs = command.call_args
            self.assertIn('BEGIN READ ONLY;', kwargs['stdin'])
            self.assertIn('default_transaction_read_only=on', kwargs['env']['PGOPTIONS'])
            self.assertNotIn('password', ' '.join(args[0]))

    def test_ssm_propagation_polling_and_path_quoting(self):
        options = {'instanceId': 'i-0123456789abcdef0', 'lines': 20,
                   'logPath': '/var/log/test; touch malicious.log'}
        responses = [
            {'Command': {'CommandId': 'command-id'}},
            {'CommandInvocations': []},
            {'CommandInvocations': [{'Status': 'Success'}]},
            {'Status': 'Success', 'ResponseCode': 0, 'StandardOutputContent': 'expected'},
        ]
        with tempfile.TemporaryDirectory() as root, \
                patch.object(runner, 'aws_call', side_effect=responses) as aws, \
                patch.object(runner.time, 'sleep'):
            self.assertEqual(runner.ec2_log(self.config, options, Path(root)), 'expected')
            sent_args = aws.call_args_list[0].args[1]
            parameters = json.loads(sent_args[-1])
            self.assertEqual(parameters['commands'], ["tail -n 20 -- '/var/log/test; touch malicious.log'"])

    def test_truncated_ec2_output_does_not_pass(self):
        responses = [
            {'Command': {'CommandId': 'command-id'}},
            {'CommandInvocations': [{'Status': 'Success'}]},
            {'Status': 'Success', 'ResponseCode': 0, 'StandardOutputContent': 'x' * 24000},
        ]
        with tempfile.TemporaryDirectory() as root, patch.object(runner, 'aws_call', side_effect=responses):
            with self.assertRaisesRegex(RuntimeError, 'truncated'):
                runner.ec2_log(self.config, {'instanceId': 'i-0123456789abcdef0',
                                          'lines': 100, 'logPath': '/var/log/app.log'}, Path(root))

    def test_skipped_browser_test_is_not_pass(self):
        with tempfile.TemporaryDirectory() as root, patch.object(runner, 'command', return_value=''):
            directory = Path(root)
            runner.save(directory / 'playwright.json', {'stats': {
                'expected': 0, 'unexpected': 0, 'skipped': 1, 'flaky': 0}})
            with self.assertRaises(AssertionError):
                runner.browser(self.case, self.config, directory)

    def test_report_escapes_error_text(self):
        with tempfile.TemporaryDirectory() as root:
            directory = Path(root)
            self.assertEqual(runner.report(directory, [
                {'name': 'test', 'status': 'FAIL', 'error': '<script>alert(1)</script>'}]), 1)
            self.assertNotIn('<script>', (directory / 'index.html').read_text())


if __name__ == '__main__':
    unittest.main()
