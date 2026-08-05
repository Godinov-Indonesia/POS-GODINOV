package middleware

import (
	"net"
	"net/http"
	"sync"
	"time"

	"golang.org/x/time/rate"

	"posgodinov-backend/pkg/logger"
	"posgodinov-backend/pkg/response"
)

type visitor struct {
	limiter  *rate.Limiter
	lastSeen time.Time
}

var (
	visitors = make(map[string]*visitor)
	mu       sync.Mutex
)

// init menjalankan goroutine pembersih map di background agar tidak memory leak
func init() {
	go cleanupVisitors()
}

func getVisitorLimiter(ip string) *rate.Limiter {
	mu.Lock()
	defer mu.Unlock()

	v, exists := visitors[ip]
	if !exists {
		// Batasan: 10 request per menit = 1 token setiap 6 detik.
		// Burst/kapasitas maksimal dalam satu waktu = 10.
		limiter := rate.NewLimiter(rate.Every(time.Minute/10), 10)
		visitors[ip] = &visitor{
			limiter:  limiter,
			lastSeen: time.Now(),
		}
		return limiter
	}

	v.lastSeen = time.Now()
	return v.limiter
}

func cleanupVisitors() {
	for {
		time.Sleep(3 * time.Minute)

		mu.Lock()
		for ip, v := range visitors {
			if time.Since(v.lastSeen) > 3*time.Minute {
				delete(visitors, ip)
			}
		}
		mu.Unlock()
	}
}

// RateLimitRegistration adalah middleware untuk membatasi endpoint registrasi khusus per IP
func RateLimitRegistration(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Dapatkan IP asli dengan menghapus port (karena RemoteAddr berupa IP:PORT)
		ip, _, err := net.SplitHostPort(r.RemoteAddr)
		if err != nil {
			ip = r.RemoteAddr
		}

		limiter := getVisitorLimiter(ip)
		if !limiter.Allow() {
			logger.Warn("rate limit exceeded", "ip", ip, "path", r.URL.Path)
			response.Error(w, http.StatusTooManyRequests, "Terlalu banyak permintaan", map[string]string{
				"rate_limit": "Anda telah melewati batas pendaftaran (10x per menit). Harap tunggu beberapa saat.",
			})
			return
		}

		next.ServeHTTP(w, r)
	}
}
