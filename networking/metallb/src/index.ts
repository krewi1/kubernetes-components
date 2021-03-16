import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { randomBytes } from "crypto";

interface Layer2Config {
  addressPools: AddressPool[];
}

interface AddressPool {
  name: string;
  addresses: string[];
}

interface MetalLbProps {
  /**
   * Layer2 config or BGP config once in future
   */
  config: Layer2Config;
}

export class MetalLb extends pulumi.ComponentResource {
  constructor(name: string, props: MetalLbProps, opts: pulumi.ComponentResourceOptions) {
    super("networking:metallb", name, props, opts);

    const labels = {
      app: "metallb",
    };

    const namespace = new k8s.core.v1.Namespace("metallb-namespace", {
      metadata: {
        name: "metallb-system",
        labels,
      },
    });

    const controllerServiceAccount = new k8s.core.v1.ServiceAccount("metallb-controller", {
      metadata: {
        name: "controller",
        namespace: namespace.metadata.name,
        labels,
      },
    });

    const speakerServiceAccount = new k8s.core.v1.ServiceAccount("metallb-speaker-sa", {
      metadata: {
        name: "speaker",
        namespace: namespace.metadata.name,
        labels,
      },
    });

    const controllerClusterRole = new k8s.rbac.v1.ClusterRole("controller-cluster-role", {
      metadata: {
        labels,
        name: "metallb-system:controller",
      },
      rules: [
        {
          apiGroups: [""],
          resources: ["services"],
          verbs: ["get", "list", "watch", "update"],
        },
        {
          apiGroups: [""],
          resources: ["services/status"],
          verbs: ["update"],
        },
        {
          apiGroups: [""],
          resources: ["events"],
          verbs: ["create", "patch"],
        },
        {
          apiGroups: ["policy"],
          resourceNames: ["controller"],
          resources: ["podsecuritypolicies"],
          verbs: ["use"],
        },
      ],
    });

    const speakerClusterRole = new k8s.rbac.v1.ClusterRole("speaker-cluster-role", {
      metadata: {
        labels,
        name: "metallb-system:speaker",
      },
      rules: [
        {
          apiGroups: [""],
          resources: ["services", "endpoints", "nodes"],
          verbs: ["get", "list", "watch"],
        },
        {
          apiGroups: [""],
          resources: ["events"],
          verbs: ["create", "patch"],
        },
        {
          apiGroups: ["policy"],
          resourceNames: ["speaker"],
          resources: ["podsecuritypolicies"],
          verbs: ["use"],
        },
      ],
    });

    const configWatcherRole = new k8s.rbac.v1.Role("config-watcher-role", {
      metadata: {
        labels,
        name: "config-watcher",
        namespace: namespace.metadata.name,
      },
      rules: [
        {
          apiGroups: [""],
          resources: ["configmaps"],
          verbs: ["get", "list", "watch"],
        },
      ],
    });

    const podListerRole = new k8s.rbac.v1.Role("pod-lister-role", {
      metadata: {
        labels,
        name: "pod-lister",
        namespace: namespace.metadata.name,
      },
      rules: [
        {
          apiGroups: [""],
          resources: ["pods"],
          verbs: ["list"],
        },
      ],
    });

    const controllerRoleBinding = new k8s.rbac.v1.ClusterRoleBinding("controller-role-binding", {
      metadata: {
        labels,
        name: "metallb-system:controller",
      },
      roleRef: {
        apiGroup: "rbac.authorization.k8s.io",
        kind: controllerClusterRole.kind,
        name: controllerClusterRole.metadata.name,
      },
      subjects: [
        {
          kind: controllerServiceAccount.kind,
          name: controllerServiceAccount.metadata.name,
          namespace: namespace.metadata.name,
        },
      ],
    });

    const speakerRoleBinding = new k8s.rbac.v1.ClusterRoleBinding("speaker-role-binding", {
      metadata: {
        labels,
        name: "metallb-system:speaker",
      },
      roleRef: {
        apiGroup: "rbac.authorization.k8s.io",
        kind: speakerClusterRole.kind,
        name: speakerClusterRole.metadata.name,
      },
      subjects: [
        {
          kind: speakerServiceAccount.kind,
          name: speakerServiceAccount.metadata.name,
          namespace: namespace.metadata.name,
        },
      ],
    });

    const configWatcherRoleBinding = new k8s.rbac.v1.RoleBinding("watcher-role-binding", {
      metadata: {
        labels,
        name: "config-watcher",
        namespace: "metallb-system",
      },
      roleRef: {
        apiGroup: "rbac.authorization.k8s.io",
        kind: configWatcherRole.kind,
        name: configWatcherRole.metadata.name,
      },
      subjects: [
        {
          kind: controllerServiceAccount.kind,
          name: controllerServiceAccount.metadata.name,
        },
        {
          kind: speakerServiceAccount.kind,
          name: speakerServiceAccount.metadata.name,
        },
      ],
    });

    const podListerRoleBinding = new k8s.rbac.v1.RoleBinding("pod-lister-role-binding", {
      metadata: {
        labels,
        name: "pod-lister",
        namespace: namespace.metadata.name,
      },
      roleRef: {
        apiGroup: "rbac.authorization.k8s.io",
        kind: podListerRole.kind,
        name: podListerRole.metadata.name,
      },
      subjects: [
        {
          kind: speakerServiceAccount.kind,
          name: speakerServiceAccount.metadata.name,
        },
      ],
    });

    const speakerLabels = {
      ...labels,
      component: "speaker",
    };

    const daemonSet = new k8s.apps.v1.DaemonSet("metallb-daemonset", {
      metadata: {
        labels: speakerLabels,
        name: "speaker",
        namespace: namespace.metadata.name,
      },
      spec: {
        selector: {
          matchLabels: speakerLabels,
        },
        template: {
          metadata: {
            annotations: {
              "prometheus.io/port": "7472",
              "prometheus.io/scrape": "true",
            },
            labels: speakerLabels,
          },
          spec: {
            containers: [
              {
                args: ["--port=7472", "--config=config"],
                env: [
                  {
                    name: "METALLB_NODE_NAME",
                    valueFrom: {
                      fieldRef: {
                        fieldPath: "spec.nodeName",
                      },
                    },
                  },
                  {
                    name: "METALLB_HOST",
                    valueFrom: {
                      fieldRef: {
                        fieldPath: "status.hostIP",
                      },
                    },
                  },
                  {
                    name: "METALLB_ML_BIND_ADDR",
                    valueFrom: {
                      fieldRef: {
                        fieldPath: "status.podIP",
                      },
                    },
                  },
                  {
                    name: "METALLB_ML_LABELS",
                    value: "app=metallb,component=speaker",
                  },
                  {
                    name: "METALLB_ML_NAMESPACE",
                    valueFrom: {
                      fieldRef: {
                        fieldPath: "metadata.namespace",
                      },
                    },
                  },
                  {
                    name: "METALLB_ML_SECRET_KEY",
                    valueFrom: {
                      secretKeyRef: {
                        name: "memberlist",
                        key: "secretkey",
                      },
                    },
                  },
                ],
                image: "metallb/speaker:v0.9.5",
                imagePullPolicy: "Always",
                name: "speaker",
                ports: [
                  {
                    containerPort: 7472,
                    name: "monitoring",
                  },
                ],
                resources: {
                  limits: {
                    cpu: "100m",
                    memory: "100Mi",
                  },
                },
                securityContext: {
                  allowPrivilegeEscalation: false,
                  capabilities: {
                    add: ["NET_ADMIN", "NET_RAW", "SYS_ADMIN"],
                    drop: ["ALL"],
                  },
                  readOnlyRootFilesystem: true,
                },
              },
            ],
            hostNetwork: true,
            nodeSelector: {
              "kubernetes.io/os": "linux",
            },
            serviceAccountName: speakerServiceAccount.metadata.name,
            terminationGracePeriodSeconds: 2,
            tolerations: [
              {
                effect: "NoSchedule",
                key: "node-role.kubernetes.io/master",
              },
            ],
          },
        },
      },
    });

    const controllerLabels = {
      ...labels,
      component: "controller",
    };
    const controllerDeployment = new k8s.apps.v1.Deployment("controller-deployment", {
      metadata: {
        labels: controllerLabels,
        name: "controller",
        namespace: namespace.metadata.name,
      },
      spec: {
        revisionHistoryLimit: 3,
        selector: {
          matchLabels: controllerLabels,
        },
        template: {
          metadata: {
            annotations: {
              "prometheus.io/port": "7472",
              "prometheus.io/scrape": "true",
            },
            labels: controllerLabels,
          },
          spec: {
            containers: [
              {
                args: ["--port=7472", "--config=config"],
                image: "metallb/controller:v0.9.5",
                imagePullPolicy: "Always",
                name: "controller",
                ports: [
                  {
                    containerPort: 7472,
                    name: "monitoring",
                  },
                ],
                resources: {
                  limits: {
                    cpu: "100m",
                    memory: "100Mi",
                  },
                },
                securityContext: {
                  allowPrivilegeEscalation: false,
                  capabilities: {
                    drop: ["all"],
                  },
                  readOnlyRootFilesystem: true,
                },
              },
            ],
            nodeSelector: {
              "kubernetes.io/os": "linux",
            },
            securityContext: {
              runAsNonRoot: true,
              runAsUser: 65534,
            },
            serviceAccountName: controllerServiceAccount.metadata.name,
            terminationGracePeriodSeconds: 0,
          },
        },
      },
    });

    const memberlistSecret = new k8s.core.v1.Secret("memberlist", {
      metadata: {
        namespace: namespace.metadata.name,
      },
      stringData: {
        secretkey: randomBytes(128).toString("base64"),
      },
    });

    const configuration = new k8s.core.v1.ConfigMap("metallb-config", {
      metadata: {
        namespace: namespace.metadata.name,
        name: "metallb-config",
      },
      data: {
        config: JSON.stringify({
          "address-pools": props.config.addressPools.map((ap) => ({
            name: ap.name,
            protocol: "layer2",
            addresses: ap.addresses,
          })),
        }),
      },
    });
  }
}
