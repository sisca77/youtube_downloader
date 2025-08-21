import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '영상 요약 서비스',
  description: 'OpenAI Whisper를 활용한 영상 요약 서비스',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <body className="min-h-screen flex flex-col">{children}</body>
    </html>
  )
}