#!/usr/bin/env bash
set -e

set -a
source .env
set +a

mvn spring-boot:run
