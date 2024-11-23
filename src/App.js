import React from 'react';
import RSSFeed from './components/RSSFeed';

const App = () => {
  const rssFeedUrl = 'https://trends.google.com/trending/rss?geo=US';

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>RSS Feed Viewer</h1>
      <h6>@LennyLetGo</h6>
      <RSSFeed feedUrl={rssFeedUrl} />
    </div>
  );
};

export default App;
