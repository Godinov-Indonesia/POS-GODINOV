# Build stage
FROM golang:1.26-alpine AS builder

WORKDIR /app

# Copy module files and download dependencies
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Build the application
RUN CGO_ENABLED=0 GOOS=linux go build -o main cmd/api/main.go

# Final stage
FROM alpine:latest

# Install tzdata and postgresql-client for pg_dump backup operations
RUN apk --no-cache add tzdata postgresql-client

WORKDIR /app

# Copy binary from builder
COPY --from=builder /app/main .

# Copy database migrations
COPY --from=builder /app/db/migrations ./db/migrations

# Expose port
EXPOSE 8080

# Command to run the application
CMD ["./main"]
