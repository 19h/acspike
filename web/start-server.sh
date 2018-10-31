#!/usr/bin/env sh

npm install
pm2 start server/ -i 2 --no-daemon
