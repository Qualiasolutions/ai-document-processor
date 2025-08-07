import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { toast } from 'react-hot-toast'

export function AuthCallback() {
  const navigate = useNavigate()

  useEffect(() => {
    async function handleAuthCallback() {
      try {
        // Get URL parameters for OAuth callback
        const urlParams = new URLSearchParams(window.location.search)
        const code = urlParams.get('code')
        
        if (code) {
          // Exchange the auth code for a session using PKCE
          const { data, error } = await supabase.auth.exchangeCodeForSession(code)

          if (error) {
            console.error('Error exchanging code for session:', error.message)
            toast.error('Authentication failed. Please try again.')
            navigate('/auth?error=' + encodeURIComponent(error.message))
            return
          }

          if (data.session) {
            toast.success('Successfully authenticated!')
            navigate('/dashboard')
            return
          }
        }

        // Check if there's a hash fragment (for other auth methods)
        const hashFragment = window.location.hash
        if (hashFragment && hashFragment.includes('access_token')) {
          // Let Supabase handle the session automatically
          const { data: { session }, error } = await supabase.auth.getSession()
          
          if (error) {
            console.error('Error getting session:', error.message)
            toast.error('Authentication failed. Please try again.')
            navigate('/auth?error=' + encodeURIComponent(error.message))
            return
          }

          if (session) {
            toast.success('Successfully authenticated!')
            navigate('/dashboard')
            return
          }
        }

        // If we get here, something went wrong
        toast.error('No authentication data found. Please try signing in again.')
        navigate('/auth')
      } catch (error) {
        console.error('Auth callback error:', error)
        toast.error('Authentication error. Please try again.')
        navigate('/auth')
      }
    }

    handleAuthCallback()
  }, [navigate])

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 flex items-center justify-center">
      <LoadingSpinner message="Completing authentication..." />
    </div>
  )
}