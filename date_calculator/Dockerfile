FROM node:20-alpine
WORKDIR /app

COPY package.json ./
COPY package-lock.json ./
COPY postcss.config.mjs ./
COPY tailwind.config.ts ./
COPY tsconfig.json ./
COPY next.config.ts ./
COPY next-env.d.ts ./
RUN npm install

COPY src ./src
COPY public ./public
EXPOSE 3000
ENV NEXT_PUBLIC_API_URL=http://localhost:5000
CMD ["npm", "run", "dev"]


