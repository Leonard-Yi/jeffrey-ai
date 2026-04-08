export default function VerifyRequestPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full p-6 bg-white rounded-lg shadow-md text-center">
        <h1 className="text-2xl font-bold mb-4">验证邮件已发送</h1>
        <p className="text-gray-600">
          我们已向您的邮箱发送了一封验证邮件。请查收并点击邮件中的链接完成注册。
        </p>
      </div>
    </div>
  )
}
