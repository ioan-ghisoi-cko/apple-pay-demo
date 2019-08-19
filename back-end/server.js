const express = require('express')
const axios = require('axios')
const https = require('https')
const bodyParser = require('body-parser')
const fs = require('fs')
const cors = require('cors')
const app = express()
app.use(bodyParser.json())
app.use(
  bodyParser.urlencoded({
    extended: true
  })
)
app.use(cors())
app.listen(3000, () => {
  console.log('Server running on port 3000')
})

// Validate the Apple Pay session
app.post('/validateSession', (req, res) => {
  // used to send the apple certificate
  const httpsAgent = new https.Agent({
    rejectUnauthorized: false,
    cert: fs.readFileSync('./certificates/certificate.pem'),
    key: fs.readFileSync('./certificates/certificate.key')
  })
  // extract the appleUrl from the POST request body
  const { appleUrl } = req.body

  // using AXIOS to do the POST request but any HTTP client can be used
  axios
    .post(
      appleUrl,
      {
        merchantIdentifier: 'merchant.test.example.com',
        domainName: 'integrationcko.ngrok.io',
        displayName: 'johnny'
      },
      { httpsAgent }
    )
    .then(function (response) {
      res.send(response.data)
    })
})

// Tokenise the Apple Pay payload and perform a payment
app.post('/pay', (req, res) => {
  const {
    version,
    data,
    signature,
    header
  } = req.body.details.token.paymentData

  // here we first generate a checkout.com token using the ApplePay
  axios
    .post(
      'https://api.sandbox.checkout.com/tokens',
      {
        type: 'applepay',
        token_data: {
          version: version,
          data: data,
          signature: signature,
          header: {
            ephemeralPublicKey: header.ephemeralPublicKey,
            publicKeyHash: header.publicKeyHash,
            transactionId: header.transactionId
          }
        }
      },
      {
        // notice in this first API call we use the public key
        headers: {
          Authorization: process.env.PUBLIC_KEY
        }
      }
    )
    .then(function (response) {
      // Checkout.com token
      const ckoToken = response.data.token
      const { billingContact, shippingContact } = req.body.details
      // Now we simply do a payment request with the checkout token
      axios
        .post(
          'https://api.sandbox.checkout.com/payments',
          {
            source: {
              type: 'token',
              token: ckoToken,
              billing_address: {
                address_line1: billingContact.addressLines[0],
                address_line2: billingContact.addressLines[1],
                city: billingContact.locality,
                state: billingContact.country,
                zip: billingContact.postalCode,
                country: billingContact.countryCode
              }
            },
            customer: {
              email: shippingContact.emailAddress
            },
            shipping: {
              address_line1: shippingContact.addressLines[0],
              address_line2: shippingContact.addressLines[1],
              city: shippingContact.locality,
              state: shippingContact.country,
              zip: shippingContact.postalCode,
              country: shippingContact.countryCode
            },
            amount: 1000,
            currency: 'USD',
            reference: 'ORD-5023-4E89'
          },
          {
            // notice in this API call we use the secret key
            headers: {
              Authorization: process.env.SECRET_KEY
            }
          }
        )
        .then(function (response) {
          res.send(response.data) // sent back the payment response
        })
    })
    .catch(function (er) {
      console.log(er)
    })
})
