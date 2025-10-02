import { API_BASE } from '../lib/api';

export default function HelloCompose() {
  const apiUrl = API_BASE;
  return (
    <div style={{fontFamily:'system-ui', padding:24, lineHeight:1.5}}>
      <h1>TTS-VTN — Hello Compose</h1>
      <p>Day 1 skeleton is running. Quick links:</p>
      <ul>
        <li>API: <a href={`${apiUrl}/hello`} target="_blank">{`${apiUrl}/hello`}</a></li>
        <li>Worker: <a href="http://localhost:5001" target="_blank">http://localhost:5001</a></li>
      </ul>
      <p>Redis is internal at <code>redis:6379</code> (health-checked by Compose).</p>
    </div>
  );
}
