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

  // Fetch the RSS feed data
  const fetchFeed = async () => {
    try {
      // DO NOT DELETE
      const proxyUrl = "https://rss-test-eta.vercel.app/api/rss-proxy";
      const response = await axios.get(`${proxyUrl}?url=${encodeURIComponent(feedUrl)}`, { responseType: "text" });

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
        `https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts`,
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

      // Manually parse and find the oldest post date
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

      // Iterate over the feedItems sequentially with a delay
      for (const item of feedItems) {
        const { totals, oldestPostDate, posts } = await fetchBlueSkyData(item.title);

        // Store Blue Sky data for each title
        dataObj[item.title] = { totals, oldestPostDate, posts };

        // Pause for 1 second (1000 ms) before making the next request
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

        // Convert pubDate to a more readable format
        const publishDate = new Date(item.pubDate).toLocaleString();

        // Create a Google search URL for the card's title
        const googleSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(item.title)}`;

        // Get Blue Sky data for the current card's title
        const blueSkyDataForCard = blueSkyData[item.title] || {
          totals: { likes: 0, reposts: 0, replies: 0 },
          oldestPostDate: null,
          posts: [],
        };

        // Format the oldest post date
        const oldestPostDate = blueSkyDataForCard.oldestPostDate
          ? formatDate(blueSkyDataForCard.oldestPostDate)
          : "No posts found";

        // Toggle dropdown for tweets
        const handleToggleDropdown = () => {
          setExpandedCard(expandedCard === item.title ? null : item.title); // Toggle between open/close
        };

        return (
          <div key={index} style={styles.card}>
            <h3 style={styles.title}>
              {item.title}{" "}
              <span style={styles.traffic}>
                ({item["ht:approx_traffic"] || "Unknown traffic"})
              </span>
            </h3>
            <p style={styles.date}>Published on: {publishDate}</p>
            <div style={styles.recentNews}>
              <h4>Recent News</h4>
              <ul style={styles.newsList}>
                {newsTitles.map((news, idx) => (
                  <li key={idx} style={styles.newsItem}>
                    {news.title}{" "}
                    <a
                      href={news.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={styles.readMore}
                    >
                      Read more
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <a
              href={googleSearchUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={styles.link}
            >
              Search "{item.title}" on Google
            </a>
            <hr />
            {/* Blue Sky Rating Section */}
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
                <div style={styles.statItem}>
                  <strong>Oldest Post Date:</strong> {oldestPostDate}
                </div>
              </div>
            </div>

            {/* Dropdown for tweets */}
            <div>
              <button onClick={handleToggleDropdown}>
                {expandedCard === item.title ? "Hide Tweets" : "View Tweets"}
              </button>
              {expandedCard === item.title && (
                <div style={styles.dropdown}>
                  {/* Display tweets here */}
                  {blueSkyDataForCard.posts.length > 0 ? (
                    blueSkyDataForCard.posts.map((post, idx) => (
                      <div key={idx}>
                        <p><strong>{post.author.displayName}</strong></p>
                        <p>{post.record.text}</p>
                        <div style={styles.statsRow}>
                          <div style={styles.statItem}>
                            <strong>Likes:</strong> {post.likeCount}
                          </div>
                          <div style={styles.statItem}>
                            <strong>Reposts:</strong> {post.repostCount}
                          </div>
                          <div style={styles.statItem}>
                            <strong>Replies:</strong> {post.replyCount}
                          </div>
                        </div>
                        <hr />
                      </div>
                    ))
                  ) : (
                    <p>No Blue Sky posts found.</p>
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
  container: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "20px",
    gap: "16px",
  },
  card: {
    width: "100%",
    maxWidth: "600px",
    border: "1px solid #ccc",
    borderRadius: "8px",
    padding: "16px",
    boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
  },
  title: {
    fontSize: "1.5rem",
    margin: "0 0 8px 0",
  },
  traffic: {
    fontSize: "1rem",
    color: "#777",
  },
  date: {
    fontSize: "0.875rem",
    color: "#999",
    marginTop: "8px",
  },
  lastUpdated: {
    fontSize: "1rem",
    color: "#555",
  },
  recentNews: {
    marginTop: "16px",
  },
  newsList: {
    listStyleType: "none",
    padding: 0,
  },
  newsItem: {
    margin: "8px 0",
  },
  readMore: {
    color: "#0077cc",
  },
  link: {
    display: "block",
    marginTop: "16px",
    color: "#0077cc",
  },
  blueSkyRating: {
    marginTop: "16px",
  },
  statsRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "16px",
    marginTop: "8px",
  },
  statItem: {
    fontSize: "1rem",
  },
  dropdown: {
    marginTop: "16px",
    padding: "8px",
    backgroundColor: "#f9f9f9",
    borderRadius: "8px",
  },
};

export default RSSFeed;
