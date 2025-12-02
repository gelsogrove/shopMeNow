import React from "react"

const AuthLogo: React.FC = () => {
  return (
    <div className="flex justify-center items-center mb-6">
      <img
        src="/logo.png"
        alt="eChatbot Logo"
        className="w-64 h-64 object-contain"
      />
    </div>
  )
}

export { AuthLogo }
export default AuthLogo
