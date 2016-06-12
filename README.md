# ac spike


## Get docker-compose

    curl -L https://github.com/docker/compose/releases/download/1.6.0/docker-compose-`uname -s`-`uname -m` > /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose

## Run the spike

    docker-compose build
    docker-compuse up -d

Then open `127.0.0.1:9000` in the browser.

## Getting started:

1) Register using the top right form. (Yeah, you need an image. Use this: https://r1.apx.pub/hero-pers-avatar.jpg in the right input box)

2) Grab an image from Google - or use this one from one of my servers: https://r1.apx.pub/hero.jpg - it will be used as cover for the auction. (Just replace the bottom image with yours if you feel like having a different image)

Open the console on `127.0.0.1:9000` and type:

    createAuction({
        title: 'My special auction',
        description: 'I like cats',
        image: 'https://r1.apx.pub/hero.jpg'
    }).then(location.reload.bind(location));

Everything else (UI) should be self-explanatory.

--------------------------------------------

Checkout `http://r2-old.apx.pub:9000/`, if you don't feel like seting anything up with docker-compose.