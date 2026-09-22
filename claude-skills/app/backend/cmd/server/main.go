package main

import (
	"log"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"ecsite/internal/auth"
	"ecsite/internal/config"
	"ecsite/internal/handler"
	"ecsite/internal/middleware"
	"ecsite/internal/service"
)

func main() {
	// All times are handled in Japan time (common spec 1.3).
	time.Local = service.JST

	cfg, err := config.Load()
	if err != nil {
		log.Fatal(err)
	}

	db, err := gorm.Open(postgres.Open(cfg.DSN()), &gorm.Config{
		TranslateError: true,
		NowFunc:        func() time.Time { return time.Now().In(service.JST) },
		Logger:         logger.Default.LogMode(logger.Warn),
	})
	if err != nil {
		log.Fatalf("connect database: %v", err)
	}

	h := handler.New(cfg,
		auth.NewJWT(cfg.JWTSecret, auth.TokenTTL),
		service.NewUserService(db),
		service.NewProductService(db),
		service.NewCartService(db),
		service.NewOrderService(db),
	)

	r := gin.New()
	r.Use(gin.Logger(), middleware.Recovery())
	h.Register(r)
	handler.RegisterFallback(r, cfg.StaticDir)

	log.Printf("listening on :%s", cfg.ServerPort)
	if err := r.Run(":" + cfg.ServerPort); err != nil {
		log.Fatal(err)
	}
}
