import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { toast } from 'react-hot-toast'

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, fullName?: string) => Promise<void>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  // Load user on mount
  useEffect(() => {
    async function loadUser() {
      try {
        const { data: { user }, error } = await supabase.auth.getUser()
        if (error) {
          console.error('Error getting user:', error)
          return
        }
        setUser(user)
        
        // Get session
        const { data: { session } } = await supabase.auth.getSession()
        setSession(session)
      } catch (error) {
        console.error('Error loading user:', error)
      } finally {
        setLoading(false)
      }
    }
    
    loadUser()

    // Set up auth listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user || null)
        setSession(session)
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  // Sign in function
  async function signIn(email: string, password: string) {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      })
      
      if (error) {
        throw error
      }
      
      toast.success('Successfully signed in!')
    } catch (error) {
      console.error('Error signing in:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to sign in')
      throw error
    }
  }

  // Sign up function
  async function signUp(email: string, password: string, fullName?: string) {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.protocol}//${window.location.host}/auth/callback`,
          data: {
            full_name: fullName || ''
          }
        }
      })
      
      if (error) {
        throw error
      }
      
      if (data.user && !data.session) {
        toast.success('Please check your email for verification link!')
      } else {
        toast.success('Account created successfully!')
      }
    } catch (error) {
      console.error('Error signing up:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to sign up')
      throw error
    }
  }

  // Sign out function
  async function signOut() {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) {
        throw error
      }
      toast.success('Successfully signed out!')
    } catch (error) {
      console.error('Error signing out:', error)
      toast.error('Failed to sign out')
      throw error
    }
  }

  // Reset password function
  async function resetPassword(email: string) {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.protocol}//${window.location.host}/auth/reset-password`
      })
      
      if (error) {
        throw error
      }
      
      toast.success('Password reset email sent!')
    } catch (error) {
      console.error('Error resetting password:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to send reset email')
      throw error
    }
  }

  const value = {
    user,
    session,
    loading,
    signIn,
    signUp,
    signOut,
    resetPassword
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}