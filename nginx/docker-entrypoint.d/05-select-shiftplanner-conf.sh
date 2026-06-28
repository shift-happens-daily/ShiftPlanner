#!/bin/sh
set -eu

CERT_FILE="/etc/letsencrypt/live/shiftplanner.online/fullchain.pem"
KEY_FILE="/etc/letsencrypt/live/shiftplanner.online/privkey.pem"

if [ -s "$CERT_FILE" ] && [ -s "$KEY_FILE" ]; then
    cp /etc/nginx/templates/default.ssl.conf /etc/nginx/conf.d/default.conf
    echo "shiftplanner nginx: using HTTPS config"
else
    cp /etc/nginx/templates/default.http.conf /etc/nginx/conf.d/default.conf
    echo "shiftplanner nginx: TLS certificate not found; using HTTP-only config"
fi
