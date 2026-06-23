import { useEffect, useState } from 'react'

/** Zero-dependency PDF preview via an <iframe> + object URL. Coordinate-anchored
 *  PDF comments would need pdf.js — deferred. */
export function PdfStage({ file }: { file: Blob }) {
  const [url, setUrl] = useState('')
  useEffect(() => {
    const u = URL.createObjectURL(file)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [file])

  return (
    <div className="stage">
      <div className="pdf-frame">
        {url && <iframe title="PDF 미리보기" src={url} />}
      </div>
      <div className="stage-hint subtle">PDF 미리보기 · 버전 관리 + 상태 리뷰 지원</div>
    </div>
  )
}
