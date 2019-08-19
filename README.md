# Front End
You simply need to open the *index.html* file from the "front-end" folder in your HTTPS whitelisted domain.

>You also need to update the *app.js* file to have your API URLs (line 32 and 33)


# Back End

There is a very basic node/express API that will handle all the API interaction with Checkout.com.
You need to run it via HTTPS so you can easily use NGROK for that.
>put your certificates in the back-end/certificates folder (name them certificate.pem and certificate.key)

Install NGROK
```ssh
npm i - g ngrok
```

Install dependecies
```ssh
cd back-end && npm i
```

Run the backend server with your keys
```ssh
PUBLIC_KEY=pk_test_XXX SECRET_KEY=sk_test_XXX npm start
```

Now use ngrok to get a public HTTPS URL for this API
> use it in a new terminal window
```ssh
ngrok http 3000
```
