const express = require('express');
const axios = require('axios');
const ytdl = require('ytdl-core');
const JSZip = require('jszip');
const cors = require('cors');
const fs = require('fs');
const SpotifyWebApi = require('spotify-web-api-node');

const app = express();
const PORT = process.env.PORT || 3000;
app.use(cors());
app.use(express.json());

// Spotify credentials
const spotifyApi = new SpotifyWebApi({
  clientId: '7f430e708ad549fdb2ae6c287d072c44',
  clientSecret: '80fd3a5e420f4288820a65e1f6534cf9',
});

// Get Spotify access token
async function getSpotifyAccessToken() {
  const data = await spotifyApi.clientCredentialsGrant();
  spotifyApi.setAccessToken(data.body['access_token']);
}

// Route to handle download
app.post('/download', async (req, res) => {
  try {
    const { playlistUrl } = req.body;
    await getSpotifyAccessToken();

    const playlistId = playlistUrl.split('playlist/')[1].split('?')[0];
    const playlistData = await spotifyApi.getPlaylistTracks(playlistId, { limit: 10 }); // Limit to 10 for demo

    const tracks = playlistData.body.items.map(item => {
      const name = item.track.name;
      const artist = item.track.artists.map(a => a.name).join(', ');
      return `${name} - ${artist}`;
    });

    const zip = new JSZip();
    for (let i = 0; i < tracks.length; i++) {
      const query = encodeURIComponent(tracks[i]);
      const ytRes = await axios.get(`https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&q=${query}&key=AIzaSyA8H-ReyRSRYbwpDzfMNkB26UfSOxv0FmE`);
      const videoId = ytRes.data.items[0]?.id?.videoId;
      const url = `https://www.youtube.com/watch?v=${videoId}`;

      const audioStream = ytdl(url, { quality: 'highestaudio' });
      const chunks = [];

      await new Promise((resolve, reject) => {
        audioStream.on('data', chunk => chunks.push(chunk));
        audioStream.on('end', () => {
          const buffer = Buffer.concat(chunks);
          zip.file(`${tracks[i]}.mp3`, buffer);
          resolve();
        });
        audioStream.on('error', err => reject(err));
      });
    }

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': 'attachment; filename="playlist.zip"',
    });
    res.send(zipBuffer);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong!' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});