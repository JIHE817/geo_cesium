<template>
  <CesiumEntity />
</template>

<script>
// 课堂作业（校园地标三维标绘，关卡 1-4）的成果组件
// 如需回到 PPT 8.4 的“默认控件”演示，把下面两处 HelloWorld 换成 CesiumEntity 的反向操作即可
import CesiumEntity from './components/CesiumEntity.vue'

export default {
  name: 'App',
  components: { CesiumEntity }
}
</script>


<!-- <template>
  <HelloWorld />
</template>

<script>
import HelloWorld from './components/HelloWorld.vue'

export default {
  name: 'App',
  components: { HelloWorld }
}
</script> -->