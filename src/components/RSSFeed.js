import React, { useEffect, useState } from "react";
import axios from "axios";
import { XMLParser } from "fast-xml-parser";
import { Configuration, OpenAIApi } from "openai";

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const RSSFeed = ({ feedUrl }) => {
  const [feedItems, setFeedItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [blueSkyData, setBlueSkyData] = useState({});
  const [expandedCard, setExpandedCard] = useState(null);
  const [generatedTweet, setGeneratedTweet] = useState({}); // Store generated tweets
  const [loadingTweet, setLoadingTweet] = useState(false);

  // OpenAI Configuration
  const openai = new OpenAIApi(
    new Configuration({
      apiKey: process.env.OPEN_AI_KEY, // Store this in .env
    })
  );

  const fetchFeed = async () => {
    try {
      const proxyUrl = "https://rss-test-eta.vercel.app/api/rss-proxy";
      const response = await axios.get(`${proxyUrl}?url=${encodeURIComponent(feedUrl)}`, { responseType: "text" });

      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: "",
      });
      const json = parser.parse(response.data);

      const items = json.rss.channel.item;
      const formattedItems = Array.isArray(items) ? items : [items];

      formattedItems.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

      setFeedItems(formattedItems);
      setLastUpdated(new Date().toLocaleString());
    } catch (error) {
      console.error("Error fetching RSS feed:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBlueSkyData = async (title) => {
    try {
      const response = await axios.get(
        `https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts`,
        { params: { q: title, sort: "latest" } }
      );
      const posts = response.data?.posts || [];
      const totals = posts.reduce(
        (acc, post) => {
          acc.likes += post.likeCount || 0;
          acc.reposts += post.repostCount || 0;
          acc.replies += post.replyCount || 0;
          return acc;
        },
        { likes: 0, reposts: 0, replies: 0 }
      );

      const oldestPostDate = posts.reduce((oldest, post) => {
        const postDate = new Date(post.indexedAt);
        return !oldest || postDate < oldest ? post.indexedAt : oldest;
      }, null);

      return { totals, oldestPostDate, posts };
    } catch (error) {
      console.error("Error fetching Blue Sky data:", error);
      return { totals: { likes: 0, reposts: 0, replies: 0 }, oldestPostDate: null, posts: [] };
    }
  };

  const generateTweet = async (titles, index) => {
    try {
      setLoadingTweet(true);

      const prompt = `
        Generate a concise and engaging tweet using the following news article titles:
        ${titles.join(", ")}.
        The tweet should summarize the theme in a compelling way and fit within 280 characters.
      `;

      const response = await openai.createCompletion({
        model: "text-davinci-003",
        prompt,
        max_tokens: 100,
      });

      const tweet = response.data.choices[0].text.trim();
      setGeneratedTweet((prev) => ({ ...prev, [index]: tweet }));
    } catch (error) {
      console.error("Error generating tweet:", error);
    } finally {
      setLoadingTweet(false);
    }
  };

  useEffect(() => {
    fetchFeed();
    const intervalId = setInterval(fetchFeed, 60000);
    return () => clearInterval(intervalId);
  }, [feedUrl]);

  useEffect(() => {
    const fetchDataForFeedItems = async () => {
      const dataObj = {};
      for (const item of feedItems) {
        const { totals, oldestPostDate, posts } = await fetchBlueSkyData(item.title);
        dataObj[item.title] = { totals, oldestPostDate, posts };
        await delay(1000);
      }
      setBlueSkyData(dataObj);
    };

    if (feedItems.length > 0) {
      fetchDataForFeedItems();
    }
  }, [feedItems]);

  if (loading) return <div>Loading...</div>;

  return (
    <div style={styles.container}>
      <h1>Google Search Trends</h1>
      <p style={styles.lastUpdated}>Last updated: {lastUpdated}</p>

      {feedItems.map((item, index) => {
        const newsItems = item["ht:news_item"];
        const newsTitles = Array.isArray(newsItems)
          ? newsItems.map((newsItem) => newsItem["ht:news_item_title"])
          : [newsItems?.["ht:news_item_title"]];

        const publishDate = new Date(item.pubDate).toLocaleString();
        const googleSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(item.title)}`;
        const tweetText = generatedTweet[index] || "";

        return (
          <div key={index} style={styles.card}>
            <h3 style={styles.title}>{item.title}</h3>
            <p style={styles.date}>Published on: {publishDate}</p>

            <button onClick={() => generateTweet(newsTitles, index)} style={styles.button}>
              {loadingTweet ? "Generating..." : "Generate Tweet"}
            </button>

            {tweetText && (
              <div style={styles.dropdown}>
                <textarea style={styles.textarea} value={tweetText} readOnly />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

const styles = {
  container: { padding: "20px", textAlign: "center" },
  card: { margin: "20px 0", padding: "10px", border: "1px solid #ddd" },
  title: { fontSize: "1.5rem" },
  date: { fontSize: "0.875rem", color: "#555" },
  button: { marginTop: "10px", padding: "8px 16px", cursor: "pointer" },
  dropdown: { marginTop: "10px" },
  textarea: { width: "100%", height: "100px", resize: "none" },
};

export default RSSFeed;
