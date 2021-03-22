version=$1
if [ -d template ]; then
    rm -rf template
fi
mkdir template
wget -O template/deploy.yaml "https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v$version/deploy/static/provider/baremetal/deploy.yaml"
kubernetes-split-yaml template/deploy.yaml