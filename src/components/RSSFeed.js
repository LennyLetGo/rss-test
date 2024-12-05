import React, { useEffect, useState } from "react";
import axios from "axios";
import { XMLParser } from "fast-xml-parser";

// Delay function to pause between requests
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const RSSFeed = ({ feedUrl }) => {
  const [feedItems, setFeedItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [blueSkyData, setBlueSkyData] = useState({});
  const [expandedCard, setExpandedCard] = useState(null); // Track expanded card for dropdown
  const [generatedTweet, setGeneratedTweet] = useState({}); // Store generated tweets
  const [loadingTweet, setLoadingTweet] = useState(null); // Track loading state for each card

  // Fetch the RSS feed data
  const fetchFeed = async () => {
    try {
      const proxyUrl = "https://rss-test-eta.vercel.app/api/rss-proxy";
      const response = await axios.get(
        `${proxyUrl}?url=${encodeURIComponent(feedUrl)}`,
        { responseType: "text" }
      );

      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: "",
      });
      const json = parser.parse(response.data);

      const items = json.rss.channel.item;
      const formattedItems = Array.isArray(items) ? items : [items]; // Ensure items are an array

      formattedItems.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

      setFeedItems(formattedItems);
      setLastUpdated(new Date().toLocaleString());
    } catch (error) {
      console.error("Error fetching RSS feed:", error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch Blue Sky data for a specific title
  const fetchBlueSkyData = async (title) => {
    try {
      const response = await axios.get(
        "https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts",
        {
          params: {
            q: title,
            sort: "latest",
          },
        }
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
        const postDateStr = post.indexedAt;
        const postDate = new Date(postDateStr); // Convert to Date object
        if (!oldest || postDate < oldest) {
          return postDateStr;
        }
        return postDateStr;
      }, null);

      return { totals, oldestPostDate, posts }; // Return actual posts
    } catch (error) {
      console.error("Error fetching Blue Sky data:", error);
      return { totals: { likes: 0, reposts: 0, replies: 0 }, oldestPostDate: null, posts: [] };
    }
  };

  // Format date manually
  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const seconds = String(date.getSeconds()).padStart(2, "0");

    return `${month}-${day}-${year} ${hours}:${minutes}:${seconds}`;
  };

  // Generate a tweet on the server side
  const generateTweet = async (titles, index) => {
    setLoadingTweet(index);
    try {
      const response = await axios.post("/api/generate-tweet", { titles });
      const tweet = response.data.tweet;
      setGeneratedTweet((prev) => ({ ...prev, [index]: tweet }));
    } catch (error) {
      console.error("Error generating tweet:", error);
    } finally {
      setLoadingTweet(null);
    }
  };

  useEffect(() => {
    fetchFeed();

    // Set interval to refresh the feed every minute
    const intervalId = setInterval(fetchFeed, 60000);
    return () => clearInterval(intervalId); // Cleanup on component unmount
  }, [feedUrl]);

  useEffect(() => {
    // Fetch Blue Sky data for each feed item sequentially with a delay
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
  }, [feedItems]); // Trigger when feedItems are updated

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

        const blueSkyDataForCard = blueSkyData[item.title] || {
          totals: { likes: 0, reposts: 0, replies: 0 },
          oldestPostDate: null,
          posts: [],
        };

        return (
          <div key={index} style={styles.card}>
            <h3 style={styles.title}>{item.title}</h3>
            <p style={styles.date}>Published on: {publishDate}</p>

            <button
              onClick={() => generateTweet(newsTitles, index)}
              style={styles.button}
              disabled={loadingTweet === index}
            >
              {loadingTweet === index ? "Generating..." : "Generate Tweet"}
            </button>

            {tweetText && (
              <div style={styles.dropdown}>
                <textarea style={styles.textarea} value={tweetText} readOnly />
              </div>
            )}

            <hr />
            <div style={styles.blueSkyRating}>
              <h4>Blue Sky Rating</h4>
              <div style={styles.statsRow}>
                <div style={styles.statItem}>
                  <strong>Total Likes:</strong> {blueSkyDataForCard.totals.likes}
                </div>
                <div style={styles.statItem}>
                  <strong>Total Reposts:</strong> {blueSkyDataForCard.totals.reposts}
                </div>
                <div style={styles.statItem}>
                  <strong>Total Replies:</strong> {blueSkyDataForCard.totals.replies}
                </div>
              </div>
            </div>
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
  statsRow: { display: "flex", gap: "10px", marginTop: "10px" },
  statItem: { fontSize: "1rem" },
};

export default RSSFeed;
