/**
 * This is a UI controller meant to handle any UI interaction
 *
 * @return {object} UI selectors and UI utility functions
 *
 */
var applePayUiController = (function () {
  var DOMStrings = {
    appleButton: 'ckoApplePay',
    errorMessage: 'ckoApplePayError'
  }
  return {
    DOMStrings,
    displayApplePayButton: function () {
      document.getElementById(DOMStrings.appleButton).style.display = 'block'
    },
    displayErrorMessage: function () {
      document.getElementById(DOMStrings.errorMessage).style.display = 'block'
    }
  }
})()

/**
 * This the controller for Apple Pay where all the business logic can be handled.
 *
 * @param {uiController} applePayUiController The UI controller
 *
 * @return {object} Contains a simple init function
 *
 */
var applePayController = (function (uiController) {
  var BACKEND_URL_VALIDATE_SESSION = 'https://8c7ec229.ngrok.io/validateSession'
  var BACKEND_URL_PAY = 'https://8c7ec229.ngrok.io/pay'

  // High level configuration options.
  var config = {
    payments: {
      acceptedCardSchemes: ['amex', 'masterCard', 'maestro', 'visa', 'mada']
    },
    shop: {
      product_price: 10.0,
      shop_name: 'Demo Shop',
      shop_localisation: {
        currencyCode: 'GBP',
        countryCode: 'GB'
      }
    },
    shipping: {
      GB_region: [
        {
          label: 'Free Shipping',
          amount: '0.00',
          detail: 'Arrives in 3-5 days',
          identifier: 'freeShipping'
        },
        {
          label: 'Express Shipping',
          amount: '5.00',
          detail: 'Arrives in 1-2 days',
          identifier: 'expressShipping'
        }
      ],
      WORLDWIDE_region: [
        {
          label: 'Worldwide Standard Shipping',
          amount: '10.00',
          detail: 'Arrives in 5-8 days',
          identifier: 'worldwideShipping'
        }
      ]
    }
  }

  /**
   * Checks if Apple Pay is possible in the current environment.
   *
   * @return {boolean} Boolean to check if Apple Pay is possible
   */
  var _applePayAvailable = function () {
    return window.ApplePaySession && ApplePaySession.canMakePayments()
  }

  /**
   * Starts the Apple Pay session using a configuration
   */
  var _startApplePaySession = function (config) {
    var applePaySession = new ApplePaySession(6, config)
    _handleApplePayEvents(applePaySession)
    applePaySession.begin()
  }

  /**
   * Sets a onClick listen on the Apple Pay button. When clicked it will
   * begin the Apple Pay session with your configuration
   */
  var _setButtonClickListener = function () {
    document
      .getElementById(uiController.DOMStrings.appleButton)
      .addEventListener('click', function () {
        _startApplePaySession({
          currencyCode: 'GBP',
          countryCode: 'GB',
          merchantCapabilities: [
            'supports3DS',
            'supportsEMV',
            'supportsCredit',
            'supportsDebit'
          ],
          supportedNetworks: config.payments.acceptedCardSchemes,
          shippingType: 'shipping',
          requiredBillingContactFields: [
            'postalAddress',
            'name',
            'phone',
            'email'
          ],
          requiredShippingContactFields: [
            'postalAddress',
            'name',
            'phone',
            'email'
          ],
          total: {
            label: config.shop.shop_name,
            amount: config.shop.product_price,
            type: 'final'
          }
        })
      })
  }

  /**
   * This method call your backend server with the Apple Pay validation URL.
   * On the backend, an POST request will be done this URL with the Apple Pay certificates
   * and the outcome will be returned
   *
   * @param {string} appleUrl The Apple Pay validation URL generated by Apple
   * @param {function} callback Callback function used to return the server call outcome
   *
   * @return {object} The payment request configuration
   *
   */
  var _validateApplePaySession = function (appleUrl, callback) {
    // I'm using AXIOS to do a POST request to the backend but any HTTP client can be used
    axios
      .post(
        BACKEND_URL_VALIDATE_SESSION,
        {
          appleUrl
        },
        {
          headers: { 'Access-Control-Allow-Origin': '*' }
        }
      )
      .then(function (response) {
        callback(response.data)
      })
  }

  /**
   * This method returns the available payment methods for a certain region. You can add
   * your business logic here to determine the shipping methods you need.
   *
   * @param {string} 2 Letter ISO of the region
   *
   * @return {Array} An array of shipping methods
   *
   */
  var _getAvailableShippingMethods = function (region) {
    // return the shipping methods available based on region
    if (region === 'GB') {
      return { methods: config.shipping.GB_region }
    } else {
      return { methods: config.shipping.WORLDWIDE_region }
    }
  }

  /**
   * This is the main method of the script, since here we handle all the Apple Pay
   * events. Here you are able to populate your shipping methods, react to  shipping methods
   * changes, and many other interaction that the user has with the Apple Pay pup-up.
   *
   * @param {object} Apple Pay Session (the one generate on the button click)
   *
   */
  var _handleApplePayEvents = function (appleSession) {
    // This is the first event that Apple triggers. Here you need to validate the
    // Apple Pay Session from your Back-End
    appleSession.onvalidatemerchant = function (event) {
      _validateApplePaySession(event.validationURL, function (merchantSession) {
        appleSession.completeMerchantValidation(merchantSession)
      })
    }

    // This method is triggered before populating the shipping methods. This is the
    // perfect place inject your shipping methods
    appleSession.onshippingcontactselected = function (event) {
      // populate with the availbale shipping methods for the region
      var shipping = _getAvailableShippingMethods(
        config.shop.shop_localisation.countryCode
      )
      // Update total and line items based on the shipping methods
      var newTotal = {
        type: 'final',
        label: config.shop.shop_name,
        amount: _calculateTotal(
          config.shop.product_price,
          shipping.methods[0].amount
        )
      }
      var newLineItems = [
        {
          type: 'final',
          label: 'Subtotal',
          amount: config.shop.product_price
        },
        {
          type: 'final',
          label: shipping.methods[0].label,
          amount: shipping.methods[0].amount
        }
      ]
      appleSession.completeShippingContactSelection(
        ApplePaySession.STATUS_SUCCESS,
        shipping.methods,
        newTotal,
        newLineItems
      )
    }

    // This method is triggered when a user select one of the shipping options.
    // Here you generally want to keep track of the transaction amount
    appleSession.onshippingmethodselected = function (event) {
      var newTotal = {
        type: 'final',
        label: config.shop.shop_name,
        amount: _calculateTotal(
          config.shop.product_price,
          event.shippingMethod.amount
        )
      }
      var newLineItems = [
        {
          type: 'final',
          label: 'Subtotal',
          amount: config.shop.product_price
        },
        {
          type: 'final',
          label: event.shippingMethod.label,
          amount: event.shippingMethod.amount
        }
      ]
      appleSession.completeShippingMethodSelection(
        ApplePaySession.STATUS_SUCCESS,
        newTotal,
        newLineItems
      )
    }

    // This method is the most important method. It gets triggered after teh user has
    // confirmed the transaction with the Touch ID or Face ID. Besides getting all the
    // details about the customer you also get the Apple Pay payload needed to perform
    // a payment.
    appleSession.onpaymentauthorized = function (event) {
      _performTransaction(event.payment, function (outcome) {
        if (outcome.approved) {
          appleSession.completePayment(ApplePaySession.STATUS_SUCCESS)
          console.log(outcome)
        } else {
          appleSession.completePayment(ApplePaySession.STATUS_FAILURE)
          console.log(outcome)
        }
      })
    }

    appleSession.oncancel = function (event) {
      console.log(event)
    }
  }

  var _performTransaction = function (details, callback) {
    // I'm using AXIOS to do a POST request to the backend but any HTTP client can be used
    axios
      .post(
        BACKEND_URL_PAY,
        {
          details
        },
        {
          headers: { 'Access-Control-Allow-Origin': '*' }
        }
      )
      .then(function (response) {
        callback(response.data)
      })
  }

  var _calculateTotal = function (subtotal, shipping) {
    return (parseFloat(subtotal) + parseFloat(shipping)).toFixed(2)
  }

  return {
    init: function () {
      if (_applePayAvailable()) {
        uiController.displayApplePayButton()
      } else {
        uiController.displayErrorMessage()
      }
      _setButtonClickListener()
    }
  }
})(applePayUiController)

applePayController.init()
