import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { randomBytes } from "crypto";

export interface NginxProps {}

export class NginxIngress extends pulumi.ComponentResource {
  constructor(name: string, props: NginxProps, opts: pulumi.ComponentResourceOptions) {
    super("networking:nginx-ingress", name, props, opts);

    const labels = {
      app: "nginx",
    };

    const namespace = new k8s.core.v1.Namespace("ingress_nginxNamespace", {
      apiVersion: "v1",
      kind: "Namespace",
      metadata: {
        name: "ingress-nginx",
        labels,
      },
    });

    const admissionServiceAccount = new k8s.core.v1.ServiceAccount("ingress_nginxIngress_nginx_admissionServiceAccount", {
      metadata: {
        name: "ingress-nginx-admission",
        labels,
        namespace: namespace.metadata.name,
      },
    });

    const admissionClusterRole = new k8s.rbac.v1.ClusterRole("ingress_nginx_admissionClusterRole", {
      apiVersion: "rbac.authorization.k8s.io/v1",
      kind: "ClusterRole",
      metadata: {
        name: "ingress-nginx-admission",
        labels: labels,
      },
      rules: [
        {
          apiGroups: ["admissionregistration.k8s.io"],
          resources: ["validatingwebhookconfigurations"],
          verbs: ["get", "update"],
        },
      ],
    });
    const admissionClusterRoleBinding = new k8s.rbac.v1.ClusterRoleBinding("ingress_nginx_admissionClusterRoleBinding", {
      apiVersion: "rbac.authorization.k8s.io/v1",
      kind: "ClusterRoleBinding",
      metadata: {
        name: "ingress-nginx-admission",
        labels: labels,
      },
      roleRef: {
        apiGroup: "rbac.authorization.k8s.io",
        kind: "ClusterRole",
        name: "ingress-nginx-admission",
      },
      subjects: [
        {
          kind: admissionServiceAccount.kind,
          name: admissionServiceAccount.metadata.name,
          namespace: namespace.metadata.name,
        },
      ],
    });

    const admission_createJob = new k8s.batch.v1.Job("ingress_nginxIngress_nginx_admission_createJob", {
      apiVersion: "batch/v1",
      kind: "Job",
      metadata: {
        name: "ingress-nginx-admission-create",
        annotations: {
          "helm.sh/hook": "pre-install,pre-upgrade",
          "helm.sh/hook-delete-policy": "before-hook-creation,hook-succeeded",
        },
        labels,
        namespace: namespace.metadata.name,
      },
      spec: {
        template: {
          metadata: {
            name: "ingress-nginx-admission-create",
            labels: {
              ...labels,
            },
          },
          spec: {
            containers: [
              {
                name: "create",
                image: "docker.io/jettech/kube-webhook-certgen:v1.5.1",
                imagePullPolicy: "IfNotPresent",
                args: [
                  "create",
                  `--host=ingress-nginx-controller-admission,ingress-nginx-controller-admission.$(POD_NAMESPACE).svc`,
                  `--namespace=$(POD_NAMESPACE)`,
                  "--secret-name=ingress-nginx-admission",
                ],
                env: [
                  {
                    name: "POD_NAMESPACE",
                    valueFrom: {
                      fieldRef: {
                        fieldPath: "metadata.namespace",
                      },
                    },
                  },
                ],
              },
            ],
            restartPolicy: "OnFailure",
            serviceAccountName: "ingress-nginx-admission",
            securityContext: {
              runAsNonRoot: true,
              runAsUser: 2000,
            },
          },
        },
      },
    });
    const ingress_nginxIngress_nginx_admission_patchJob = new k8s.batch.v1.Job("ingress_nginxIngress_nginx_admission_patchJob", {
      apiVersion: "batch/v1",
      kind: "Job",
      metadata: {
        name: "ingress-nginx-admission-patch",
        labels,
        namespace: namespace.metadata.name,
      },
      spec: {
        template: {
          metadata: {
            name: "ingress-nginx-admission-patch",
            labels: {
              "helm.sh/chart": "ingress-nginx-3.23.0",
              "app.k8s.io/name": namespace.metadata.name,
              "app.k8s.io/instance": namespace.metadata.name,
              "app.k8s.io/version": "0.44.0",
              "app.k8s.io/managed-by": "Helm",
              "app.k8s.io/component": "admission-webhook",
            },
          },
          spec: {
            containers: [
              {
                name: "patch",
                image: "docker.io/jettech/kube-webhook-certgen:v1.5.1",
                imagePullPolicy: "IfNotPresent",
                args: [
                  "patch",
                  "--webhook-name=ingress-nginx-admission",
                  `--namespace=$(POD_NAMESPACE)`,
                  "--patch-mutating=false",
                  "--secret-name=ingress-nginx-admission",
                  "--patch-failure-policy=Fail",
                ],
                env: [
                  {
                    name: "POD_NAMESPACE",
                    valueFrom: {
                      fieldRef: {
                        fieldPath: "metadata.namespace",
                      },
                    },
                  },
                ],
              },
            ],
            restartPolicy: "OnFailure",
            serviceAccountName: "ingress-nginx-admission",
            securityContext: {
              runAsNonRoot: true,
              runAsUser: 2000,
            },
          },
        },
      },
    });
    const ingress_nginxIngress_nginx_admissionRoleBinding = new k8s.rbac.v1.RoleBinding("ingress_nginxIngress_nginx_admissionRoleBinding", {
      apiVersion: "rbac.authorization.k8s.io/v1",
      kind: "RoleBinding",
      metadata: {
        name: "ingress-nginx-admission",
        annotations: {
          "helm.sh/hook": "pre-install,pre-upgrade,post-install,post-upgrade",
          "helm.sh/hook-delete-policy": "before-hook-creation,hook-succeeded",
        },
        labels: {
          "helm.sh/chart": "ingress-nginx-3.23.0",
          "app.k8s.io/name": namespace.metadata.name,
          "app.k8s.io/instance": namespace.metadata.name,
          "app.k8s.io/version": "0.44.0",
          "app.k8s.io/managed-by": "Helm",
          "app.k8s.io/component": "admission-webhook",
        },
        namespace: namespace.metadata.name,
      },
      roleRef: {
        apiGroup: "rbac.authorization.k8s.io",
        kind: "Role",
        name: "ingress-nginx-admission",
      },
      subjects: [
        {
          kind: "ServiceAccount",
          name: "ingress-nginx-admission",
          namespace: namespace.metadata.name,
        },
      ],
    });
    const ingress_nginxIngress_nginx_admissionRole = new k8s.rbac.v1.Role("ingress_nginxIngress_nginx_admissionRole", {
      apiVersion: "rbac.authorization.k8s.io/v1",
      kind: "Role",
      metadata: {
        name: "ingress-nginx-admission",
        annotations: {
          "helm.sh/hook": "pre-install,pre-upgrade,post-install,post-upgrade",
          "helm.sh/hook-delete-policy": "before-hook-creation,hook-succeeded",
        },
        labels: {
          "helm.sh/chart": "ingress-nginx-3.23.0",
          "app.k8s.io/name": namespace.metadata.name,
          "app.k8s.io/instance": namespace.metadata.name,
          "app.k8s.io/version": "0.44.0",
          "app.k8s.io/managed-by": "Helm",
          "app.k8s.io/component": "admission-webhook",
        },
        namespace: namespace.metadata.name,
      },
      rules: [
        {
          apiGroups: [""],
          resources: ["secrets"],
          verbs: ["get", "create"],
        },
      ],
    });

    const ingress_nginx_admissionValidatingWebhookConfiguration = new k8s.admissionregistration.v1.ValidatingWebhookConfiguration(
      "ingress_nginx_admissionValidatingWebhookConfiguration",
      {
        apiVersion: "admissionregistration.k8s.io/v1",
        kind: "ValidatingWebhookConfiguration",
        metadata: {
          labels: {
            "helm.sh/chart": "ingress-nginx-3.23.0",
            "app.k8s.io/name": namespace.metadata.name,
            "app.k8s.io/instance": namespace.metadata.name,
            "app.k8s.io/version": "0.44.0",
            "app.k8s.io/managed-by": "Helm",
            "app.k8s.io/component": "admission-webhook",
          },
          name: "ingress-nginx-admission",
        },
        webhooks: [
          {
            name: "validate.nginx.ingress.k8s.io",
            matchPolicy: "Equivalent",
            rules: [
              {
                apiGroups: ["networking.k8s.io"],
                apiVersions: ["v1beta1"],
                operations: ["CREATE", "UPDATE"],
                resources: ["ingresses"],
              },
            ],
            failurePolicy: "Fail",
            sideEffects: "None",
            admissionReviewVersions: ["v1", "v1beta1"],
            clientConfig: {
              service: {
                namespace: namespace.metadata.name,
                name: "ingress-nginx-controller-admission",
                path: "/networking/v1beta1/ingresses",
              },
            },
          },
        ],
      }
    );
    const ingress_nginxIngress_nginx_controller_admissionService = new k8s.core.v1.Service(
      "ingress_nginxIngress_nginx_controller_admissionService",
      {
        apiVersion: "v1",
        kind: "Service",
        metadata: {
          labels: {
            "helm.sh/chart": "ingress-nginx-3.23.0",
            "app.k8s.io/name": namespace.metadata.name,
            "app.k8s.io/instance": namespace.metadata.name,
            "app.k8s.io/version": "0.44.0",
            "app.k8s.io/managed-by": "Helm",
            "app.k8s.io/component": "controller",
          },
          name: "ingress-nginx-controller-admission",
          namespace: namespace.metadata.name,
        },
        spec: {
          type: "ClusterIP",
          ports: [
            {
              name: "https-webhook",
              port: 443,
              targetPort: "webhook",
            },
          ],
          selector: {
            "app.k8s.io/name": namespace.metadata.name,
            "app.k8s.io/instance": namespace.metadata.name,
            "app.k8s.io/component": "controller",
          },
        },
      }
    );
    const ingress_nginxIngress_nginx_controllerConfigMap = new k8s.core.v1.ConfigMap("ingress_nginxIngress_nginx_controllerConfigMap", {
      apiVersion: "v1",
      kind: "ConfigMap",
      metadata: {
        labels: {
          "helm.sh/chart": "ingress-nginx-3.23.0",
          "app.k8s.io/name": namespace.metadata.name,
          "app.k8s.io/instance": namespace.metadata.name,
          "app.k8s.io/version": "0.44.0",
          "app.k8s.io/managed-by": "Helm",
          "app.k8s.io/component": "controller",
        },
        name: "ingress-nginx-controller",
        namespace: namespace.metadata.name,
      },
      data: undefined,
    });
    const ingress_nginxIngress_nginx_controllerDeployment = new k8s.apps.v1.Deployment("ingress_nginxIngress_nginx_controllerDeployment", {
      apiVersion: "apps/v1",
      kind: "Deployment",
      metadata: {
        labels: {
          "helm.sh/chart": "ingress-nginx-3.23.0",
          "app.k8s.io/name": namespace.metadata.name,
          "app.k8s.io/instance": namespace.metadata.name,
          "app.k8s.io/version": "0.44.0",
          "app.k8s.io/managed-by": "Helm",
          "app.k8s.io/component": "controller",
        },
        name: "ingress-nginx-controller",
        namespace: namespace.metadata.name,
      },
      spec: {
        selector: {
          matchLabels: {
            "app.k8s.io/name": namespace.metadata.name,
            "app.k8s.io/instance": namespace.metadata.name,
            "app.k8s.io/component": "controller",
          },
        },
        revisionHistoryLimit: 10,
        minReadySeconds: 0,
        template: {
          metadata: {
            labels: {
              "app.k8s.io/name": namespace.metadata.name,
              "app.k8s.io/instance": namespace.metadata.name,
              "app.k8s.io/component": "controller",
            },
          },
          spec: {
            dnsPolicy: "ClusterFirst",
            containers: [
              {
                name: "controller",
                image:
                  "k8s.gcr.io/ingress-nginx/controller:v0.44.0@sha256:3dd0fac48073beaca2d67a78c746c7593f9c575168a17139a9955a82c63c4b9a",
                imagePullPolicy: "IfNotPresent",
                lifecycle: {
                  preStop: {
                    exec: {
                      command: ["/wait-shutdown"],
                    },
                  },
                },
                args: [
                  "/nginx-ingress-controller",
                  "--election-id=ingress-controller-leader",
                  "--ingress-class=nginx",
                  `--configmap=$(POD_NAMESPACE)/ingress-nginx-controller`,
                  "--validating-webhook=:8443",
                  "--validating-webhook-certificate=/usr/local/certificates/cert",
                  "--validating-webhook-key=/usr/local/certificates/key",
                ],
                securityContext: {
                  capabilities: {
                    drop: ["ALL"],
                    add: ["NET_BIND_SERVICE"],
                  },
                  runAsUser: 101,
                  allowPrivilegeEscalation: true,
                },
                env: [
                  {
                    name: "POD_NAME",
                    valueFrom: {
                      fieldRef: {
                        fieldPath: "metadata.name",
                      },
                    },
                  },
                  {
                    name: "POD_NAMESPACE",
                    valueFrom: {
                      fieldRef: {
                        fieldPath: "metadata.namespace",
                      },
                    },
                  },
                  {
                    name: "LD_PRELOAD",
                    value: "/usr/local/lib/libmimalloc.so",
                  },
                ],
                livenessProbe: {
                  httpGet: {
                    path: "/healthz",
                    port: 10254,
                    scheme: "HTTP",
                  },
                  initialDelaySeconds: 10,
                  periodSeconds: 10,
                  timeoutSeconds: 1,
                  successThreshold: 1,
                  failureThreshold: 5,
                },
                readinessProbe: {
                  httpGet: {
                    path: "/healthz",
                    port: 10254,
                    scheme: "HTTP",
                  },
                  initialDelaySeconds: 10,
                  periodSeconds: 10,
                  timeoutSeconds: 1,
                  successThreshold: 1,
                  failureThreshold: 3,
                },
                ports: [
                  {
                    name: "http",
                    containerPort: 80,
                    protocol: "TCP",
                  },
                  {
                    name: "https",
                    containerPort: 443,
                    protocol: "TCP",
                  },
                  {
                    name: "webhook",
                    containerPort: 8443,
                    protocol: "TCP",
                  },
                ],
                volumeMounts: [
                  {
                    name: "webhook-cert",
                    mountPath: "/usr/local/certificates/",
                    readOnly: true,
                  },
                ],
                resources: {
                  requests: {
                    cpu: "100m",
                    memory: "90Mi",
                  },
                },
              },
            ],
            serviceAccountName: namespace.metadata.name,
            terminationGracePeriodSeconds: 300,
            volumes: [
              {
                name: "webhook-cert",
                secret: {
                  secretName: "ingress-nginx-admission",
                },
              },
            ],
          },
        },
      },
    });
    const ingress_nginxIngress_nginx_controllerService = new k8s.core.v1.Service("ingress_nginxIngress_nginx_controllerService", {
      apiVersion: "v1",
      kind: "Service",
      metadata: {
        annotations: undefined,
        labels: {
          "helm.sh/chart": "ingress-nginx-3.23.0",
          "app.k8s.io/name": namespace.metadata.name,
          "app.k8s.io/instance": namespace.metadata.name,
          "app.k8s.io/version": "0.44.0",
          "app.k8s.io/managed-by": "Helm",
          "app.k8s.io/component": "controller",
        },
        name: "ingress-nginx-controller",
        namespace: namespace.metadata.name,
      },
      spec: {
        type: "LoadBalancer",
        ports: [
          {
            name: "http",
            port: 80,
            protocol: "TCP",
            targetPort: "http",
          },
          {
            name: "https",
            port: 443,
            protocol: "TCP",
            targetPort: "https",
          },
        ],
        selector: {
          "app.k8s.io/name": namespace.metadata.name,
          "app.k8s.io/instance": namespace.metadata.name,
          "app.k8s.io/component": "controller",
        },
      },
    });
    const ingress_nginxClusterRole = new k8s.rbac.v1.ClusterRole("ingress_nginxClusterRole", {
      apiVersion: "rbac.authorization.k8s.io/v1",
      kind: "ClusterRole",
      metadata: {
        labels: {
          "helm.sh/chart": "ingress-nginx-3.23.0",
          "app.k8s.io/name": namespace.metadata.name,
          "app.k8s.io/instance": namespace.metadata.name,
          "app.k8s.io/version": "0.44.0",
          "app.k8s.io/managed-by": "Helm",
        },
        name: namespace.metadata.name,
      },
      rules: [
        {
          apiGroups: [""],
          resources: ["configmaps", "endpoints", "nodes", "pods", "secrets"],
          verbs: ["list", "watch"],
        },
        {
          apiGroups: [""],
          resources: ["nodes"],
          verbs: ["get"],
        },
        {
          apiGroups: [""],
          resources: ["services"],
          verbs: ["get", "list", "watch"],
        },
        {
          apiGroups: ["extensions", "networking.k8s.io"],
          resources: ["ingresses"],
          verbs: ["get", "list", "watch"],
        },
        {
          apiGroups: [""],
          resources: ["events"],
          verbs: ["create", "patch"],
        },
        {
          apiGroups: ["extensions", "networking.k8s.io"],
          resources: ["ingresses/status"],
          verbs: ["update"],
        },
        {
          apiGroups: ["networking.k8s.io"],
          resources: ["ingressclasses"],
          verbs: ["get", "list", "watch"],
        },
      ],
    });
    const ingress_nginxClusterRoleBinding = new k8s.rbac.v1.ClusterRoleBinding("ingress_nginxClusterRoleBinding", {
      apiVersion: "rbac.authorization.k8s.io/v1",
      kind: "ClusterRoleBinding",
      metadata: {
        labels: {
          "helm.sh/chart": "ingress-nginx-3.23.0",
          "app.k8s.io/name": namespace.metadata.name,
          "app.k8s.io/instance": namespace.metadata.name,
          "app.k8s.io/version": "0.44.0",
          "app.k8s.io/managed-by": "Helm",
        },
        name: namespace.metadata.name,
      },
      roleRef: {
        apiGroup: "rbac.authorization.k8s.io",
        kind: "ClusterRole",
        name: namespace.metadata.name,
      },
      subjects: [
        {
          kind: "ServiceAccount",
          name: namespace.metadata.name,
          namespace: namespace.metadata.name,
        },
      ],
    });

    const ingress_nginxIngress_nginxRoleBinding = new k8s.rbac.v1.RoleBinding("ingress_nginxIngress_nginxRoleBinding", {
      apiVersion: "rbac.authorization.k8s.io/v1",
      kind: "RoleBinding",
      metadata: {
        labels: {
          "helm.sh/chart": "ingress-nginx-3.23.0",
          "app.k8s.io/name": namespace.metadata.name,
          "app.k8s.io/instance": namespace.metadata.name,
          "app.k8s.io/version": "0.44.0",
          "app.k8s.io/managed-by": "Helm",
          "app.k8s.io/component": "controller",
        },
        name: namespace.metadata.name,
        namespace: namespace.metadata.name,
      },
      roleRef: {
        apiGroup: "rbac.authorization.k8s.io",
        kind: "Role",
        name: namespace.metadata.name,
      },
      subjects: [
        {
          kind: "ServiceAccount",
          name: namespace.metadata.name,
          namespace: namespace.metadata.name,
        },
      ],
    });
    const ingress_nginxIngress_nginxRole = new k8s.rbac.v1.Role("ingress_nginxIngress_nginxRole", {
      apiVersion: "rbac.authorization.k8s.io/v1",
      kind: "Role",
      metadata: {
        labels: {
          "helm.sh/chart": "ingress-nginx-3.23.0",
          "app.k8s.io/name": "ingress-nginx",
          "app.k8s.io/instance": "ingress-nginx",
          "app.k8s.io/version": "0.44.0",
          "app.k8s.io/managed-by": "Helm",
          "app.k8s.io/component": "controller",
        },
        name: "ingress-nginx",
        namespace: "ingress-nginx",
      },
      rules: [
        {
          apiGroups: [""],
          resources: ["namespaces"],
          verbs: ["get"],
        },
        {
          apiGroups: [""],
          resources: ["configmaps", "pods", "secrets", "endpoints"],
          verbs: ["get", "list", "watch"],
        },
        {
          apiGroups: [""],
          resources: ["services"],
          verbs: ["get", "list", "watch"],
        },
        {
          apiGroups: ["extensions", "networking.k8s.io"],
          resources: ["ingresses"],
          verbs: ["get", "list", "watch"],
        },
        {
          apiGroups: ["extensions", "networking.k8s.io"],
          resources: ["ingresses/status"],
          verbs: ["update"],
        },
        {
          apiGroups: ["networking.k8s.io"],
          resources: ["ingressclasses"],
          verbs: ["get", "list", "watch"],
        },
        {
          apiGroups: [""],
          resources: ["configmaps"],
          resourceNames: ["ingress-controller-leader-nginx"],
          verbs: ["get", "update"],
        },
        {
          apiGroups: [""],
          resources: ["configmaps"],
          verbs: ["create"],
        },
        {
          apiGroups: [""],
          resources: ["events"],
          verbs: ["create", "patch"],
        },
      ],
    });
    const ingress_nginxIngress_nginxServiceAccount = new k8s.core.v1.ServiceAccount("ingress_nginxIngress_nginxServiceAccount", {
      apiVersion: "v1",
      kind: "ServiceAccount",
      metadata: {
        labels: {
          "helm.sh/chart": "ingress-nginx-3.23.0",
          "app.k8s.io/name": "ingress-nginx",
          "app.k8s.io/instance": "ingress-nginx",
          "app.k8s.io/version": "0.44.0",
          "app.k8s.io/managed-by": "Helm",
          "app.k8s.io/component": "controller",
        },
        name: "ingress-nginx",
        namespace: "ingress-nginx",
      },
    });
  }
}
