FROM node:16

WORKDIR /app

COPY package.json ./
RUN npm install

COPY Scheduler.js .

ENV OPENAI_API_KEY=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

CMD ["node", "Scheduler.js"]