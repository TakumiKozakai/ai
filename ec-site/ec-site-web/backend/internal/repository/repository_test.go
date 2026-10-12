package repository

import "testing"

func TestEscapeLike(t *testing.T) {
	tests := map[string]string{
		"coffee":  "coffee",
		"100%":    `100\%`,
		"a_b":     `a\_b`,
		`back\sl`: `back\\sl`,
	}
	for in, want := range tests {
		if got := EscapeLike(in); got != want {
			t.Errorf("EscapeLike(%q) = %q, want %q", in, got, want)
		}
	}
}
