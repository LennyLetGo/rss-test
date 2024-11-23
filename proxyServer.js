const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
app.use(cors());

app.get("/rss-proxy", async (req, res) => {
  const { url } = req.query; // The RSS feed URL
  if (!url) return res.status(400).send("URL query parameter is required");

  try {
    const response = await axios.get(url, { responseType: "text" });
    res.send(response.data);
  } catch (error) {
    res.status(500).send("Error fetching RSS feed");
  }
});

const PORT = 4000;
app.listen(PORT, () => console.log(`Proxy server running on port ${PORT}`));
