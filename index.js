const fs = require("fs");
const readline = require("readline");
const { google } = require("googleapis");

// If modifying these scopes, delete token.json.
const SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.modify",
];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = "token.json";

// Load client secrets from a local file.
fs.readFile("credentials.json", (err, content) => {
  if (err) return console.log("Error loading client secret file:", err);
  // Authorize a client with credentials, then call the Gmail API.
  // authorize(JSON.parse(content), listLabels);
  authorize(JSON.parse(content), listAllMessages);
});

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(credentials, callback) {
  const { client_secret, client_id, redirect_uris } = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uris[0]
  );

  // Check if we have previously stored a token.
  fs.readFile(TOKEN_PATH, (err, token) => {
    if (err) return getNewToken(oAuth2Client, callback);
    oAuth2Client.setCredentials(JSON.parse(token));
    callback(oAuth2Client);
  });
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback for the authorized client.
 */
function getNewToken(oAuth2Client, callback) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
  });
  console.log("Authorize this app by visiting this url:", authUrl);
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.question("Enter the code from that page here: ", (code) => {
    rl.close();
    oAuth2Client.getToken(code, (err, token) => {
      if (err) return console.error("Error retrieving access token", err);
      oAuth2Client.setCredentials(token);
      // Store the token to disk for later program executions
      fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
        if (err) return console.error(err);
        console.log("Token stored to", TOKEN_PATH);
      });
      callback(oAuth2Client);
    });
  });
}

/**
 * Lists the labels in the user's account.
 *
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
function listLabels(auth) {
  const gmail = google.gmail({ version: "v1", auth });
  gmail.users.labels.list(
    {
      userId: "me",
    },
    (err, res) => {
      if (err) return console.log("The API returned an error: " + err);
      const labels = res.data.labels;
      if (labels.length) {
        console.log("Labels:");
        labels.forEach((label) => {
          console.log(`- ${label.name}`);
        });
      } else {
        console.log("No labels found.");
      }
    }
  );
}

async function readMessage(auth, messageId) {
  const gmail = google.gmail({ version: "v1", auth });
  console.log({ messageId });

  // await gmail.users.messages
  //   .get({ userId: "me", id: messageId })
  //   .then(async ({ data }) => {
  //     console.log("RESPOSTA", data.snippet);

  //     // const messageData = Buffer.from(
  //     //   messageContent.payload.body.data,
  //     //   "base64"
  //     // ).toString();

  //     // console.log("TEXTO DO EMAIL", messageData);
  //   })
  //   .catch((error) => console.error("DEU ERRO", error));

  await gmail.users.messages
    .modify({
      requestBody: { removeLabelIds: ["UNREAD"] },
      userId: "me",
      id: messageId,
    })
    .then(({ data }) => {
      console.log("RESPOSTA DO UPDATE NO GMAIL", data);
    })
    .catch((error) => {
      console.error("ERRO AO CONSULTAR GMAIL", error);
      throw error;
    });
}

async function listAllMessages(auth) {
  const gmail = google.gmail({ version: "v1", auth });
  let nextPageToken = null;

  let messagesCount = null;

  const getMessagesRecursive = async () => {
    await gmail.users.messages
      .list({
        userId: "me",
        labelIds: ["INBOX", "UNREAD"],
        pageToken: nextPageToken,
      })
      .then(async ({ data }) => {
        const messagesList = data.messages;
        const totalMessages = messagesList.length;
        // console.log("TOTAL DE MENSAGENS", totalMessages);
        messagesCount += totalMessages;
        console.log("TOTAL DE MENSAGENS", messagesCount);
        for (const i in messagesList) {
          readMessage(auth, messagesList[i].id);
        }

        if (totalMessages === 100) {
          nextPageToken = data.nextPageToken;
          getMessagesRecursive();
        }
      })
      .catch((error) => {
        console.error("DEU ERRO", error);
        throw error;
      });
  };

  await getMessagesRecursive();
}