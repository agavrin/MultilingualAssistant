const http = require('http');
//var dumper = require('dumper').dumper;
//const rp = require("request-promise");
var _ = require('lodash');
const express = require('express');
const app = express();
const LanguageTranslatorV3 = require('ibm-watson/language-translator/v3');
const {
	IamAuthenticator
} = require('ibm-watson/auth');

const DEFAULT_DIALOG_LANGUAGE_CODE = "en"
const UNKNOWN = "unknown";

var WATSON_LANGUAGE_TRANSLATOR_URL = process.env.WATSON_LANGUAGE_TRANSLATOR_URL || UNKNOWN;
var WATSON_LANGUAGE_TRANSLATOR_APIKEY = process.env.WATSON_LANGUAGE_TRANSLATOR_APIKEY || UNKNOWN;

/**
 * Instantiate the Watson Language Translator Service
 */

const languageTranslator = new LanguageTranslatorV3({
	// See: https://github.com/watson-developer-cloud/node-sdk#authentication
	version: '2018-05-01',
	serviceUrl: WATSON_LANGUAGE_TRANSLATOR_URL,
	authenticator: new IamAuthenticator({
		apikey: WATSON_LANGUAGE_TRANSLATOR_APIKEY,
	})
});

app.use(express.json());


// Pre-message webhook

app.post('/premessage', (req, res) => {
	// dumper(req.body);
	var inputMessage = req.body;
	const identifyParams = {
		text: inputMessage.payload.input.text
	};

	// By default - no translation
	inputMessage.payload.context.skills["main skill"].user_defined["language"] = "none";
	// Identify language of the request
	languageTranslator.identify(identifyParams)
		.then(identifiedLanguages => {

			let firstLanguageIdentified = identifiedLanguages.result.languages[0];
			const language = firstLanguageIdentified.confidence > 0.5 ? firstLanguageIdentified.language : DEFAULT_DIALOG_LANGUAGE_CODE;
			console.log("PREMESSAGE: Text: "+inputMessage.payload.input.text);
			console.log("PREMESSAGE: Language of the request identified: " + firstLanguageIdentified.language + " ("+firstLanguageIdentified.confidence+")");
			console.log("PREMESSAGE: Language used: "+language);

			if (language !== DEFAULT_DIALOG_LANGUAGE_CODE) {
				// Need to translate
				const translateParams = {
					text: inputMessage.payload.input.text,
					modelId: firstLanguageIdentified.language + '-' + DEFAULT_DIALOG_LANGUAGE_CODE,
				};
				console.log("PREMESSAGE: Translation: "+firstLanguageIdentified.language + ' -> ' + DEFAULT_DIALOG_LANGUAGE_CODE);
				languageTranslator.translate(translateParams)
					.then(translationResult => {
						// Save the original input
						inputMessage.payload.context.skills["main skill"].user_defined["original_input"] = inputMessage.payload.input.text;
						inputMessage.payload.context.skills["main skill"].user_defined["language"] = language;
						// Update text of the message
						inputMessage.payload.input.text = translationResult.result.translations[0].translation;
						// Send updated message back to WA
						res.json(inputMessage);
					})
					.catch(err => {
						console.log('error:', err);
						res.json(inputMessage);
					});
			} else {
				console.log("PREMESSAGE: No translation.");
				// If language matching default - no translation needed
				res.json(inputMessage);
			}
		})
		.catch(err => {
			console.log('error:', err);
		});

});


app.post('/postmessage', (req, res) => {
	// dumper(req.body);
	var outputMessage = req.body;
	var language = outputMessage.payload.context.skills["main skill"].user_defined["language"];
	console.log("POSTMESSAGE: Text: "+outputMessage.payload.output.generic[0].text);
	if (language == "none" || language == DEFAULT_DIALOG_LANGUAGE_CODE) {
		console.log("POSTMESSAGE: Language = " + language + ". No Translation.");
		res.json(outputMessage);
	} else {
		console.log("POSTMESSAGE: Will translate from " + DEFAULT_DIALOG_LANGUAGE_CODE + " to " + language);
		const translateParams = {
			text: outputMessage.payload.output.generic[0].text,
			modelId: DEFAULT_DIALOG_LANGUAGE_CODE + '-' + language
		};

		languageTranslator.translate(translateParams)
			.then(translationResult => {
				// Save the original input
				outputMessage.payload.context.skills["main skill"].user_defined["original_output"] = outputMessage.payload.output.generic[0].text;
				// Update text of the message
				outputMessage.payload.output.generic[0].text = translationResult.result.translations[0].translation;
				// Send updated message back
				res.json(outputMessage);
			})
			.catch(err => {
				console.log('error:', err);
			});

	}


});




app.get('/health', (req, res) => {
	var myError = "";
	if (WATSON_LANGUAGE_TRANSLATOR_URL == UNKNOWN) myError = "Provide WATSON_LANGUAGE_TRANSLATOR_URL environmental variable"
	if (WATSON_LANGUAGE_TRANSLATOR_APIKEY == UNKNOWN) myError = "Provide WATSON_LANGUAGE_TRANSLATOR_APIKEY environmental variable"

	const translateParams = {
		text: "Привет",
		modelId: "ru-en"
	};

	languageTranslator.translate(translateParams)
		.then(translationResult => {
			res.json({
				status: "OK",
				translatedText: translationResult.result.translations[0].translation
			});
		})
		.catch(err => {
			res.json({
				status: "FAILED",
				enverror: myError,
				error: err
			});
		});


});


function mainFunction(object) {
	if (object.payload.input.text !== "") {

		const options = {
			method: "POST",
			url: "https://<WATSON_LANGUAGE_TRANSLATOR_URL>/instances/<YOUR_INSTANCE_ID>/v3/identify?version=2018-05-01",
			auth: {
				username: "apikey",
				password: "<WATSON_LANGUAGE_TRANSLATOR_APIKEY>",
			},
			headers: {
				"Content-Type": "text/plain",
			},
			body: [params.payload.input.text],
			json: true,
		};




		//const post = bent(WATSON_LANGUAGE_TRANSLATOR_URL, 'POST', 'json', 200);
		//const response = await post('cars/new', {name: 'bmw', wheels: 4});



		return rp(options).then((res) => {
			var defaultDialogLanguageCode = "en";
			const confidence = _.get(res, "languages[0].confidence");
			console.log("confidence " + confidence);
			const language =
				confidence > 0.5 ? _.get(res, "languages[0].language") : defaultDialogLanguageCode;
			_.set(params, 'payload.context.skills["main skill"].user_defined["language"]', language);
			if (res.languages[0].language !== defaultDialogLanguageCode) {
				const options = {
					method: "POST",
					url: "https://<WATSON_LANGUAGE_TRANSLATOR_URL>/instances/<YOUR_INSTANCE_ID>/v3/translate?version=2018-05-01",
					auth: {
						username: "apikey",
						password: "<WATSON_LANGUAGE_TRANSLATOR_APIKEY>",
					},
					body: {
						text: [params.payload.input.text],
						target: defaultDialogLanguageCode,
					},
					json: true,
				};
				return rp(options).then((res) => {
					console.log("PRE-Translate - translating");
					params.payload.context.skills["main skill"].user_defined["original_input"] =
						params.payload.input.text;
					params.payload.input.text = res.translations[0].translation;
					console.log(JSON.stringify(params));
					// const result = {
					//   body: params,
					// };
					return {
						params
					};
				});
			} else {
				console.log(JSON.stringify(params));
				// const result = {
				//   body: params,
				// };
				return {
					params
				};
			}
		});
	} else {
		params.payload.context.skills["main skill"].user_defined["language"] = "none";
		// const result = {
		//   body: params,
		// };
		return {
			params
		};
	}
}

var port = process.env.PORT || "8080";
app.listen(port);

console.log('Server running at http://0.0.0.0:' + port + '/');
