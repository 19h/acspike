FROM node:latest

RUN apt-get update && apt-get install -y ntp

RUN npm install -g pm2@latest

RUN mkdir -p /opt/app
WORKDIR /opt/app
RUN cd /opt/app

CMD ["/bin/bash", "/opt/app/install.sh"]
CMD ["/bin/bash", "/opt/app/start-server.sh"]