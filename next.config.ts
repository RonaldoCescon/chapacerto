import withPWAInit from 'next-pwa';

const withPWA = withPWAInit({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development', // Desativa no localhost para não travar seu cache enquanto programa
  register: true,
  skipWaiting: true,
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Suas outras configurações (se tiver) ficam aqui
};

export default withPWA(nextConfig);