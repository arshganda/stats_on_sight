// Copyright 2016 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

'use strict';

const process = require('process'); // Required to mock environment variables

// [START gae_storage_app]
const { format } = require('util');
const express = require('express');
const Multer = require('multer');
const bodyParser = require('body-parser');
const vision = require('@google-cloud/vision');
const httpClient = require('https');

// By default, the client will authenticate using the service account file
// specified by the GOOGLE_APPLICATION_CREDENTIALS environment variable and use
// the project specified by the GOOGLE_CLOUD_PROJECT environment variable. See
// https://github.com/GoogleCloudPlatform/google-cloud-node/blob/master/docs/authentication.md
// These environment variables are set automatically on Google App Engine
const { Storage } = require('@google-cloud/storage');

// Instantiate a storage client
const storage = new Storage();

const app = express();
app.set('view engine', 'pug');
app.use(bodyParser.json());

// Multer is required to process file uploads and make them available via
// req.files.
const multer = Multer({
  storage: Multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // no larger than 10mb, you can change as needed.
  },
});

const teamNameMap = {
  "NJD": 1,
  "NYI": 2,
  "NYR": 3,
  "PHI": 4,
  "PIT": 5,
  "BOS": 6,
  "BUF": 7,
  "MTL": 8,
  "OTT": 9,
  "TOR": 10,
  "CAR": 12,
  "FLA": 13,
  "TBL": 14,
  "WSH": 15,
  "CHI": 16,
  "DET": 17,
  "NSH": 18,
  "STL": 19,
  "CGY": 20,
  "COL": 21,
  "EDM": 22,
  "VAN": 23,
  "ANA": 24,
  "DAL": 25,
  "LAK": 26,
  "SJS": 28,
  "CBJ": 29,
  "MIN": 30,
  "WPG": 52,
  "ARI": 53,
  "VGK": 54,
};

// A bucket is a container for objects (files).
const bucket = storage.bucket(process.env.GCLOUD_STORAGE_BUCKET);

// Display a form for uploading files.
app.get('/', (req, res) => {
  res.render('form.pug');
});

// Process the file upload and upload to Google Cloud Storage.
app.post('/upload', multer.single('file'), (req, res, next) => {
  if (!req.file) {
    res.status(400).send('No file uploaded.');
    return;
  }

  // Create a new blob in the bucket and upload the file data.
  const blob = bucket.file(req.file.originalname);
  const blobStream = blob.createWriteStream({
    resumable: false,
  });

  blobStream.on('error', err => {
    next(err);
  });

  blobStream.on('finish', async () => {
    // The public URL can be used to directly access the file via HTTP.
    const publicUrl = format(
      `https://storage.googleapis.com/${bucket.name}/${blob.name}`
    );

    // Creates a client
    const client = new vision.ImageAnnotatorClient();

    // Performs label detection on the image file
    const [result] = await client.textDetection(publicUrl);
    const detections = result.textAnnotations;
    let teamIds = getTeamIdsFromText(detections[0].description);

    res.status(200).send(teamIds);
  });

  blobStream.end(req.file.buffer);
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`App listening on port ${PORT}`);
  console.log('Press Ctrl+C to quit.');
});
// [END gae_storage_app]

module.exports = app;

const getTeamIdsFromText = (description) => {
  let words = description.split(" ");
  let teams = [];
  words.forEach((word) => {
    if (teamNameMap.hasOwnProperty(word)) {
      teams.push(teamNameMap[word]);
    };
  });
  getCurrentGame(teams[0]);
  return teams;
};

function getCurrentGame(teamID) {
  let requestURL = "https://statsapi.web.nhl.com/api/v1/teams/" + teamID + "?expand=team.schedule.next";
  httpClient.get(requestURL, (res) => {
    let body = "";
    res.on('data', (chunk) => {
      body += chunk;
    })

    res.on('end', () => {
      try {
        let json = JSON.parse(body);
        let gameID = (json['teams'][0]['nextGameSchedule']['dates'][0]['games'][0].gamePk);
        console.log(gameID);
        getGameStats(gameID);
      }
      catch (err) {
        console.log(err);
      }
    })
  });
}

function getGameStats(gameID) {
  let requestURL = "https://statsapi.web.nhl.com/api/v1/game/" + gameID + "/boxscore";
  httpClient.get(requestURL, (res) => {
    let body = "";
    res.on('data', (chunk) => {
      body += chunk;
    })

    res.on('end', () => {
      try {
        let json = JSON.parse(body);
        console.log(json);
      }
      catch (err) {
        console.log(err);
      }
    })
  });
}