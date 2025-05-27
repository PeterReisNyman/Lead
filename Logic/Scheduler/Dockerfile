FROM node:16

WORKDIR /app

COPY package.json ./
RUN npm install

COPY Scheduler.js .

ENV OPENAI_API_KEY=${OPENAI_API_KEY}

CMD ["node", "Scheduler.js"]