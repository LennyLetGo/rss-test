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
  const [expandedBlueSky, setExpandedBlueSky] = useState(null); // Track dropdown state for Blue Sky tweets
  const [generatedTweet, setGeneratedTweet] = useState({});
  const [loadingTweet, setLoadingTweet] = useState(null);

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

      return { totals, posts };
    } catch (error) {
      console.error("Error fetching Blue Sky data:", error);
      return { totals: { likes: 0, reposts: 0, replies: 0 }, posts: [] };
    }
  };

  // Generate a tweet on the server side
  const generateTweet = async (titles, index) => {
    setLoadingTweet(index);
    try {
      const response = await axios.post("https://rss-test-eta.vercel.app/api/generate-tweet", { titles });
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

    // Refresh feed every minute
    const intervalId = setInterval(fetchFeed, 60000);
    return () => clearInterval(intervalId);
  }, [feedUrl]);

  useEffect(() => {
    const fetchDataForFeedItems = async () => {
      const dataObj = {};

      for (const item of feedItems) {
        const { totals, posts } = await fetchBlueSkyData(item.title);
        dataObj[item.title] = { totals, posts };
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
          ? newsItems.map((newsItem) => ({
              title: newsItem["ht:news_item_title"],
              url: newsItem["ht:news_item_url"],
            }))
          : [
              {
                title: newsItems?.["ht:news_item_title"],
                url: newsItems?.["ht:news_item_url"],
              },
            ];

        const blueSkyDataForCard = blueSkyData[item.title] || {
          totals: { likes: 0, reposts: 0, replies: 0 },
          posts: [],
        };
        const tweetText = generatedTweet[index] || "";

        return (
          <div key={index} style={styles.card}>
            <h3 style={styles.title}>{item.title}</h3>
            <p style={styles.date}>Published on: {new Date(item.pubDate).toLocaleString()}</p>

            {/* News Stories List */}
            <div style={styles.recentNews}>
              <h4>Recent News</h4>
              <ul style={styles.newsList}>
                {newsTitles.map((news, idx) => (
                  <li key={idx}>
                    <a
                      href={news.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={styles.link}
                    >
                      {news.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Generate Tweet */}
            <button
              onClick={() => generateTweet(newsTitles.map((n) => n.title), index)}
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

            {/* Blue Sky Rating with Tweets Dropdown */}
            <div style={styles.blueSkyRating}>
              <h4>Blue Sky Rating</h4>
              <div style={styles.statsRow}>
                <div>Total Likes: {blueSkyDataForCard.totals.likes}</div>
                <div>Total Reposts: {blueSkyDataForCard.totals.reposts}</div>
                <div>Total Replies: {blueSkyDataForCard.totals.replies}</div>
              </div>
              <button
                onClick={() =>
                  setExpandedBlueSky(
                    expandedBlueSky === item.title ? null : item.title
                  )
                }
                style={styles.button}
              >
                {expandedBlueSky === item.title ? "Hide Tweets" : "View Tweets"}
              </button>
              {expandedBlueSky === item.title && (
                <div style={styles.dropdown}>
                  {blueSkyDataForCard.posts.length > 0 ? (
                    blueSkyDataForCard.posts.map((post, idx) => (
                      <div key={idx} style={styles.tweet}>
                        <strong>{post.author.displayName}</strong>
                        <p>{post.record.text}</p>
                        <small>
                          Likes: {post.likeCount}, Reposts: {post.repostCount}, Replies:{" "}
                          {post.replyCount}
                        </small>
                        <hr />
                      </div>
                    ))
                  ) : (
                    <p>No tweets found.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

const styles = {
  container: { padding: "20px" },
  card: { margin: "20px 0", padding: "20px", border: "1px solid #ddd" },
  title: { fontSize: "1.5rem" },
  date: { fontSize: "0.875rem", color: "#555" },
  recentNews: { marginTop: "20px" },
  newsList: { listStyleType: "none", padding: 0 },
  link: { color: "#0077cc" },
  button: { marginTop: "10px", padding: "8px 16px", cursor: "pointer" },
  dropdown: { marginTop: "10px" },
  textarea: { width: "100%", height: "100px", resize: "none" },
  blueSkyRating: { marginTop: "20px" },
  statsRow: { display: "flex", gap: "10px", marginBottom: "10px" },
  tweet: { marginBottom: "10px" },
};

export default RSSFeed;
