output "sns_topic_arn" {
  value = aws_sns_topic.this.arn
}

output "alarm_names" {
  value = [for a in aws_cloudwatch_metric_alarm.this : a.alarm_name]
}
