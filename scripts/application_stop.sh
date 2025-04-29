#!/bin/bash
set -e
set -x

 cd /opt/polis
if [ "$SERVICE" = "server" ]; then
    /usr/local/bin/docker-compose stop server
elif [ "$SERVICE" = "math" ]; then
    /usr/local/bin/docker-compose stop math
fi