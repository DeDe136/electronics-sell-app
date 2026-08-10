{{- define "electronics-shop.backendImage" -}}
{{ .Values.image.registry }}/{{ .Values.image.project }}/{{ .Values.image.backendRepository }}:{{ .Values.image.tag }}
{{- end -}}

{{- define "electronics-shop.frontendImage" -}}
{{ .Values.image.registry }}/{{ .Values.image.project }}/{{ .Values.image.frontendRepository }}:{{ .Values.image.tag }}
{{- end -}}
