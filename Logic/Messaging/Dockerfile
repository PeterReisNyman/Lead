FROM node:16

WORKDIR /app

COPY package.json ./
RUN npm install

COPY Messenger.js .

ENV TWILIO_ACCOUNT_SID=${TWILIO_ACCOUNT_SID}
ENV TWILIO_AUTH_TOKEN=${TWILIO_AUTH_TOKEN}
ENV TWILIO_PHONE_NUMBER=${TWILIO_PHONE_NUMBER}
ENV OPENAI_API_KEY=${OPENAI_API_KEY}

CMD ["node", "Messenger.js"]