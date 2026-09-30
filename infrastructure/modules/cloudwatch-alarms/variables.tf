variable "name_prefix" {
  type = string
}

variable "cluster_name" {
  type = string
}

variable "log_group_name" {
  description = "CloudWatch log group chứa log control plane của EKS."
  type        = string
}

variable "alarm_email_addresses" {
  description = "Email nhận cảnh báo (mỗi email phải bấm 'Confirm subscription' trong thư AWS gửi)."
  type        = list(string)

  validation {
    condition     = length(var.alarm_email_addresses) > 0
    error_message = "Cần ít nhất 1 email để nhận cảnh báo."
  }
}

variable "thresholds" {
  description = "Ngưỡng (số bản ghi log khớp trong 5 phút) để kích hoạt từng alarm."
  type = object({
    api_server_5xx       = number
    api_server_throttled = number
    api_unauthorized     = number
    authenticator_denied = number
    control_plane_errors = number
  })
  default = {
    api_server_5xx       = 5
    api_server_throttled = 20
    api_unauthorized     = 30
    authenticator_denied = 5
    control_plane_errors = 50
  }
}
