// Centralise les helpers liés aux appels HTTP externes.
import axios from 'axios';
import { env } from '../config/index.js';

export { axios };

export const linkedinHeaders = {
  'User-Agent': env.liUserAgent,
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': env.liAcceptLanguage,
  'Cache-Control': 'no-cache',
  Pragma: 'no-cache',
};
