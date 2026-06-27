FROM nginx:1.27-alpine

COPY default.conf /etc/nginx/templates/default.ssl.conf
COPY default.http.conf /etc/nginx/templates/default.http.conf
COPY docker-entrypoint.d/05-select-shiftplanner-conf.sh /docker-entrypoint.d/05-select-shiftplanner-conf.sh

RUN chmod +x /docker-entrypoint.d/05-select-shiftplanner-conf.sh
