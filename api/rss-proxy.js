const axios = require('axios')

const handler = async (req, res) => {
  const { url } = req.query; // Get the feed URL from the query params
  console.log('API HIT')
  if (!url) {
    return res.status(400).json({ error: "URL parameter is required" });
  }

  try {
    const response = await axios.get(decodeURIComponent(url), { responseType: "text" });
    res.status(200).send(response.data); // Return the fetched data
  } catch (error) {
    res.status(500).json({ error: "Error fetching the RSS feed" });
  }
}

module.exports = handler