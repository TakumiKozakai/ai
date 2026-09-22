package config

import (
	"fmt"
	"net/url"
	"os"
	"strings"
)

// Config holds settings read from environment variables (see app/.env.example).
type Config struct {
	DBHost       string
	DBPort       string
	DBName       string
	DBUser       string
	DBPassword   string
	ServerPort   string
	JWTSecret    string
	CookieSecure bool
	StaticDir    string
}

const minJWTSecretLength = 32

func Load() (*Config, error) {
	cfg := &Config{
		DBHost:       getenv("POSTGRES_HOST", "localhost"),
		DBPort:       getenv("POSTGRES_PORT", "5432"),
		DBName:       os.Getenv("POSTGRES_DB"),
		DBUser:       os.Getenv("POSTGRES_USER"),
		DBPassword:   os.Getenv("POSTGRES_PASSWORD"),
		ServerPort:   getenv("SERVER_PORT", "8080"),
		JWTSecret:    os.Getenv("JWT_SECRET"),
		CookieSecure: strings.EqualFold(os.Getenv("COOKIE_SECURE"), "true"),
		StaticDir:    getenv("STATIC_DIR", "../frontend/dist"),
	}

	var missing []string
	for name, v := range map[string]string{
		"POSTGRES_DB":       cfg.DBName,
		"POSTGRES_USER":     cfg.DBUser,
		"POSTGRES_PASSWORD": cfg.DBPassword,
		"JWT_SECRET":        cfg.JWTSecret,
	} {
		if v == "" {
			missing = append(missing, name)
		}
	}
	if len(missing) > 0 {
		return nil, fmt.Errorf("required environment variables are not set: %s", strings.Join(missing, ", "))
	}
	if len(cfg.JWTSecret) < minJWTSecretLength {
		return nil, fmt.Errorf("JWT_SECRET must be at least %d characters", minJWTSecretLength)
	}
	return cfg, nil
}

// DSN returns the PostgreSQL connection URL. TimeZone is fixed to Asia/Tokyo so that
// CURRENT_TIMESTAMP defaults are stored in Japan time like the values set by the app.
func (c *Config) DSN() string {
	u := url.URL{
		Scheme:   "postgres",
		User:     url.UserPassword(c.DBUser, c.DBPassword),
		Host:     c.DBHost + ":" + c.DBPort,
		Path:     "/" + c.DBName,
		RawQuery: "sslmode=disable&TimeZone=Asia/Tokyo",
	}
	return u.String()
}

func getenv(name, fallback string) string {
	if v := os.Getenv(name); v != "" {
		return v
	}
	return fallback
}
