import React, { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Brain, Mail, Lock, User, ArrowRight } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const signInSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters')
})

const signUpSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string(),
  fullName: z.string().min(2, 'Full name must be at least 2 characters')
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"]
})

type SignInFormData = z.infer<typeof signInSchema>
type SignUpFormData = z.infer<typeof signUpSchema>

export function AuthPage() {
  const { signIn, signUp } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('signin')

  const from = location.state?.from?.pathname || '/dashboard'

  const signInForm = useForm<SignInFormData>({
    resolver: zodResolver(signInSchema)
  })

  const signUpForm = useForm<SignUpFormData>({
    resolver: zodResolver(signUpSchema)
  })

  const handleSignIn = async (data: SignInFormData) => {
    setLoading(true)
    try {
      await signIn(data.email, data.password)
      navigate(from, { replace: true })
    } catch (error) {
      // Error handling is done in the auth context
    } finally {
      setLoading(false)
    }
  }

  const handleSignUp = async (data: SignUpFormData) => {
    setLoading(true)
    try {
      await signUp(data.email, data.password, data.fullName)
      setActiveTab('signin')
    } catch (error) {
      // Error handling is done in the auth context
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo and Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="p-3 bg-gradient-to-r from-blue-600 to-green-600 rounded-xl">
              <Brain className="w-8 h-8 text-white" />
            </div>
            <div className="text-left">
              <h1 className="text-2xl font-bold text-gray-900">
                Qualia Solutions
              </h1>
              <p className="text-sm text-gray-600">AI Form-Filler Pro</p>
            </div>
          </div>
          <p className="text-gray-600">
            Transform your documents into professional forms with AI
          </p>
        </div>

        {/* Auth Forms */}
        <Card className="shadow-xl border-0">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>
            
            <TabsContent value="signin">
              <CardHeader>
                <CardTitle>Welcome back</CardTitle>
                <CardDescription>
                  Sign in to continue your AI form processing
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={signInForm.handleSubmit(handleSignIn)} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        id="signin-email"
                        type="email"
                        placeholder="Enter your email"
                        className="pl-10"
                        {...signInForm.register('email')}
                      />
                    </div>
                    {signInForm.formState.errors.email && (
                      <p className="text-sm text-red-600">
                        {signInForm.formState.errors.email.message}
                      </p>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="signin-password">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        id="signin-password"
                        type="password"
                        placeholder="Enter your password"
                        className="pl-10"
                        {...signInForm.register('password')}
                      />
                    </div>
                    {signInForm.formState.errors.password && (
                      <p className="text-sm text-red-600">
                        {signInForm.formState.errors.password.message}
                      </p>
                    )}
                  </div>
                  
                  <Button
                    type="submit"
                    className="w-full bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700"
                    disabled={loading}
                  >
                    {loading ? (
                      'Signing in...'
                    ) : (
                      <>
                        Sign In
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </TabsContent>
            
            <TabsContent value="signup">
              <CardHeader>
                <CardTitle>Create account</CardTitle>
                <CardDescription>
                  Join thousands of professionals using AI for form processing
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={signUpForm.handleSubmit(handleSignUp)} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name">Full Name</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        id="signup-name"
                        type="text"
                        placeholder="Enter your full name"
                        className="pl-10"
                        {...signUpForm.register('fullName')}
                      />
                    </div>
                    {signUpForm.formState.errors.fullName && (
                      <p className="text-sm text-red-600">
                        {signUpForm.formState.errors.fullName.message}
                      </p>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        id="signup-email"
                        type="email"
                        placeholder="Enter your email"
                        className="pl-10"
                        {...signUpForm.register('email')}
                      />
                    </div>
                    {signUpForm.formState.errors.email && (
                      <p className="text-sm text-red-600">
                        {signUpForm.formState.errors.email.message}
                      </p>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        id="signup-password"
                        type="password"
                        placeholder="Create a password"
                        className="pl-10"
                        {...signUpForm.register('password')}
                      />
                    </div>
                    {signUpForm.formState.errors.password && (
                      <p className="text-sm text-red-600">
                        {signUpForm.formState.errors.password.message}
                      </p>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="signup-confirm">Confirm Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        id="signup-confirm"
                        type="password"
                        placeholder="Confirm your password"
                        className="pl-10"
                        {...signUpForm.register('confirmPassword')}
                      />
                    </div>
                    {signUpForm.formState.errors.confirmPassword && (
                      <p className="text-sm text-red-600">
                        {signUpForm.formState.errors.confirmPassword.message}
                      </p>
                    )}
                  </div>
                  
                  <Button
                    type="submit"
                    className="w-full bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700"
                    disabled={loading}
                  >
                    {loading ? (
                      'Creating account...'
                    ) : (
                      <>
                        Create Account
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </TabsContent>
          </Tabs>
        </Card>
        
        {/* Features */}
        <div className="mt-8 text-center text-sm text-gray-600">
          <p>✨ AI-powered document analysis</p>
          <p>📄 Professional form generation</p>
          <p>🔒 Enterprise-grade security</p>
        </div>
      </div>
    </div>
  )
}