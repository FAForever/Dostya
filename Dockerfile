FROM node:13.6.0-alpine

# Create app directory
WORKDIR /usr/src/dostya

# Because the irc library has a git dependency; npm/yarn need git installed; so
# install it along with dependencies.
RUN apk update && apk upgrade && apk add --no-cache bash git openssh sqlite

# Install app dependencies
# Copy over yarn.lock file as well as any unfortunate soul who uses NPM's package-lock.

COPY package*.json ./
COPY yarn.lock .

RUN yarn

# If you are building your code for production
# RUN npm install --only=production

# Bundle app source
COPY . .

CMD [ "node", "launch.js" ]

EXPOSE 3003