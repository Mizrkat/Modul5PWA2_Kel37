const USER_IDENTIFIER_KEY = 'bore_barrel_user_id'
const USER_PROFILE_KEY = 'bore_barrel_user_profile'

const isValidUUID = (str) =>
  typeof str === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str)

const generateUUID = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export const getUserIdentifier = () => {
  try {
    let userId = localStorage.getItem(USER_IDENTIFIER_KEY)
    if (!userId || !isValidUUID(userId)) {
      userId = generateUUID()
      localStorage.setItem(USER_IDENTIFIER_KEY, userId)
    }
    return userId
  } catch {
    return generateUUID()
  }
}

export const getUserProfile = () => {
  try {
    const raw = localStorage.getItem(USER_PROFILE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    /* fallback to default */
  }
  return {
    username: 'Shooter',
    avatar: null,
    bio: 'Certified Tactical Armorer & Range Officer.',
    userId: getUserIdentifier(),
  }
}

export const saveUserProfile = (profile) => {
  try {
    const data = {
      ...profile,
      userId: getUserIdentifier(),
      updatedAt: new Date().toISOString(),
    }
    localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(data))
    return { success: true, data }
  } catch (err) {
    return { success: false, message: err.message }
  }
}

export const updateUsername = (username) => {
  const profile = getUserProfile()
  profile.username = username.trim() || 'Shooter'
  return saveUserProfile(profile)
}

export const updateBio = (bio) => {
  const profile = getUserProfile()
  profile.bio = bio.trim()
  return saveUserProfile(profile)
}

export const updateAvatar = (avatarBase64) => {
  const profile = getUserProfile()
  profile.avatar = avatarBase64
  return saveUserProfile(profile)
}

export const resetUserIdentifier = () => {
  try {
    localStorage.removeItem(USER_IDENTIFIER_KEY)
    localStorage.removeItem(USER_PROFILE_KEY)
    return getUserIdentifier()
  } catch {
    return `anon_${Date.now()}`
  }
}

export default {
  getUserIdentifier,
  getUserProfile,
  saveUserProfile,
  updateUsername,
  updateBio,
  updateAvatar,
  resetUserIdentifier,
}
