/**
 * DVAI-038 — Logger utility
 * In produzione tutti i log vengono soppressi.
 * In sviluppo si comporta come console normale.
 *
 * Uso:
 *   import logger from '@/utils/logger';
 *   logger.log('messaggio');
 *   logger.warn('attenzione');
 *   logger.error('errore'); // errori sempre visibili in produzione
 */

const isDev = import.meta.env.DEV;

const logger = {
  log:   isDev ? console.log.bind(console)   : () => {},
  warn:  isDev ? console.warn.bind(console)  : () => {},
  info:  isDev ? console.info.bind(console)  : () => {},
  debug: isDev ? console.debug.bind(console) : () => {},
  // Gli errori restano visibili anche in produzione (utili per Sentry, ecc.)
  error: console.error.bind(console),
};

export default logger;
