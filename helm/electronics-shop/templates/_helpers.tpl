{{- define "electronics-shop.backendImage" -}}
{{ .Values.image.registry }}/{{ .Values.image.project }}/{{ .Values.image.backendRepository }}:{{ .Values.image.backendTag }}
{{- end -}}

{{- define "electronics-shop.frontendImage" -}}
{{ .Values.image.registry }}/{{ .Values.image.project }}/{{ .Values.image.frontendRepository }}:{{ .Values.image.frontendTag }}
{{- end -}}
