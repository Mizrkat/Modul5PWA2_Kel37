import axios from 'axios'
import { BASE_URL, SUPABASE_KEY, IS_SUPABASE } from '../config/api'
import { warmImageDiskCache } from '../utils/queryCache'

// ---------------------------------------------------------------------------
// UploadService — Single & Multi-image upload service.
// Sets Cache-Control headers on uploaded images so browsers cache them in
// disk cache (`(disk cache)` in DevTools Network tab).
// ---------------------------------------------------------------------------
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
const MAX_SIZE_BYTES = 5 * 1024 * 1024 // 5 MB

class UploadService {
  /**
   * Upload a single image file.
   * @param {File} file
   * @returns {Promise<{ success: boolean, data: { url: string, filename: string } }>}
   */
  async uploadImage(file) {
    if (!file) {
      throw new Error('No file provided.')
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      throw new Error(
        'Invalid file type. Allowed formats: .jpg, .jpeg, .png, .webp',
      )
    }
    if (file.size > MAX_SIZE_BYTES) {
      throw new Error('File size exceeds the 5 MB limit.')
    }

    // --- Supabase Storage flow ---
    if (IS_SUPABASE) {
      const ext = file.name.split('.').pop() || 'png'
      const fileName = `gun_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${ext}`
      const bucketName = 'guns'
      try {
        const uploadUrl = `${BASE_URL}/storage/v1/object/${bucketName}/${fileName}`
        await axios.post(uploadUrl, file, {
          headers: {
            'Content-Type': file.type,
            'Cache-Control': 'public, max-age=31536000, immutable',
            'x-upsert': 'true',
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
          },
          timeout: 30000,
        })
        const publicUrl = `${BASE_URL}/storage/v1/object/public/${bucketName}/${fileName}`
        warmImageDiskCache({ image_url: publicUrl })
        return {
          success: true,
          data: { url: publicUrl, filename: fileName },
        }
      } catch (err) {
        console.warn(
          'Supabase bucket upload not accessible, creating base64 data URL:',
          err,
        )
        const dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result)
          reader.onerror = reject
          reader.readAsDataURL(file)
        })
        return {
          success: true,
          data: { url: dataUrl, filename: file.name },
        }
      }
    }

    // --- University API flow (/api/v1/upload) ---
    const formData = new FormData()
    formData.append('image', file)
    const response = await axios.post(`${BASE_URL}/api/v1/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 30000,
    })
    return response.data
  }

  /**
   * Upload multiple image files in parallel for a single catalog item.
   * @param {File[]|FileList} files
   * @returns {Promise<{ success: boolean, data: Array<{ url: string, filename: string }> }>}
   */
  async uploadMultipleImages(files) {
    const fileArray = Array.from(files || [])
    if (fileArray.length === 0) {
      throw new Error('No image files selected.')
    }
    const results = await Promise.all(
      fileArray.map((file) => this.uploadImage(file)),
    )
    const uploaded = results
      .filter((r) => r && r.success && r.data?.url)
      .map((r) => r.data)

    return {
      success: uploaded.length > 0,
      data: uploaded,
    }
  }
}

export default new UploadService()
