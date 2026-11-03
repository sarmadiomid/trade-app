/**
 * Wire Node's global fetch (used by dukascopy-node) through an HTTP/HTTPS/SOCKS proxy.
 *
 * Env (first match wins):
 *   DUKASCOPY_PROXY   e.g. http://127.0.0.1:7890  or  socks5://127.0.0.1:1080
 *   HTTPS_PROXY / https_proxy
 *   HTTP_PROXY  / http_proxy
 *
 * For Docker + host sing-box, use host.docker.internal or the host LAN IP, not 127.0.0.1
 * inside the container (unless network_mode: host).
 */

export async function applyIngestProxy(): Promise<string | null> {
  const proxyUrl =
    process.env.DUKASCOPY_PROXY?.trim() ||
    process.env.HTTPS_PROXY?.trim() ||
    process.env.https_proxy?.trim() ||
    process.env.HTTP_PROXY?.trim() ||
    process.env.http_proxy?.trim() ||
    '';

  if (!proxyUrl) return null;

  let parsed: URL;
  try {
    parsed = new URL(proxyUrl);
  } catch {
    throw new Error(`Invalid proxy URL: ${proxyUrl}`);
  }

  if (!['http:', 'https:', 'socks5:', 'socks5h:', 'socks4:'].includes(parsed.protocol)) {
    throw new Error(
      `Unsupported proxy protocol "${parsed.protocol}" (use http:// or socks5://)`,
    );
  }

  const { ProxyAgent, setGlobalDispatcher } = await import('undici');
  setGlobalDispatcher(new ProxyAgent(proxyUrl));
  return `${parsed.protocol}//${parsed.hostname}:${parsed.port || defaultPort(parsed.protocol)}`;
}

function defaultPort(protocol: string): string {
  if (protocol === 'https:') return '443';
  if (protocol.startsWith('socks')) return '1080';
  return '80';
}
